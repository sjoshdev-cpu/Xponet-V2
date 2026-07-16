/**
 * Xponet Workspace Agent
 * -----------------------
 * Firebase Cloud Function (v2, callable) that turns a natural-language request
 * ("create a bug tracker database with a status and priority column, then add
 * a task to fix the login bug") into real writes against the same Firestore
 * collections the app already uses (pages, tasks, databases, records).
 *
 * Why a Cloud Function rather than a direct client -> Gemini call:
 *  - Keeps the Gemini API key server-side.
 *  - Runs with the Admin SDK (bypasses security rules), so we MUST enforce
 *    org membership ourselves before executing anything the model proposes.
 *  - Lets us validate/normalize model output before it touches Firestore.
 *
 * Model: Gemini 2.5 Flash (free tier, function calling + JSON mode). Set
 * AGENT_MODEL below to 'gemini-2.5-flash-lite' for cheaper/faster simple intents.
 *
 * IMPORTANT — this file was adapted from the original template to match the
 * app's real data shapes. The load-bearing corrections (without which writes
 * silently vanish or don't render) are called out with "// FIX:" comments.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!admin.apps.length) admin.initializeApp();

// FIX: the app stores everything in the NAMED database "xponet", not the
// implicit "(default)" database. admin.firestore() targets (default) — so the
// original code wrote to a database the app never reads and nothing appeared.
// Match the client (getFirestore(app, "xponet")) and the reminders script.
const db = getFirestore('xponet');

const AGENT_MODEL = 'gemini-2.5-flash'; // or 'gemini-2.5-flash-lite'
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Enums kept in sync with the app (TaskTable badges, DB property types).
const TASK_STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const TASK_EFFORTS = ['XS', 'S', 'M', 'L', 'XL'];
const PROPERTY_TYPES = [
  'title', 'text', 'select', 'multi_select', 'people', 'date', 'checkbox',
  'number', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by',
];

// ---------------------------------------------------------------------------
// 1. Tool declarations — one per action the agent is allowed to take.
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'create_page',
        description:
          'Create a plain workspace page (a document or note). For structured, ' +
          'table-like data use create_database instead — do NOT try to make a ' +
          'database with this tool.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Page title' },
            icon: { type: 'STRING', description: 'A single emoji, optional' },
            content: { type: 'STRING', description: 'Plain-text body content, optional' },
            parent_id: { type: 'STRING', description: 'Parent page id for nesting, optional' },
          },
          required: ['title'],
        },
      },
      {
        name: 'create_task',
        description: 'Create a task on the workspace task board.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            description: { type: 'STRING' },
            status: { type: 'STRING', enum: TASK_STATUSES },
            priority: { type: 'STRING', enum: TASK_PRIORITIES },
            assignee_email: { type: 'STRING', description: 'Email of a workspace member to assign, optional' },
            due_date: { type: 'STRING', description: 'ISO 8601 date, e.g. 2026-08-01' },
            effort: { type: 'STRING', enum: TASK_EFFORTS },
          },
          required: ['title'],
        },
      },
      {
        name: 'create_database',
        description:
          'Create a new Notion-style database with a property schema. Always ' +
          'include exactly one property of type "title". Use select/multi_select ' +
          'with options for status/priority/category style columns.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            schema: {
              type: 'ARRAY',
              description: 'Property definitions (columns)',
              items: {
                type: 'OBJECT',
                properties: {
                  key: { type: 'STRING', description: 'Short machine key, e.g. "status"' },
                  name: { type: 'STRING', description: 'Human column label, e.g. "Status"' },
                  type: { type: 'STRING', enum: PROPERTY_TYPES },
                  options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'For select/multi_select types' },
                },
                required: ['key', 'type'],
              },
            },
          },
          required: ['name', 'schema'],
        },
      },
      {
        name: 'add_database_property',
        description: 'Add a new property/column to an existing database.',
        parameters: {
          type: 'OBJECT',
          properties: {
            database_id: { type: 'STRING' },
            key: { type: 'STRING' },
            name: { type: 'STRING', description: 'Human column label' },
            type: { type: 'STRING', enum: PROPERTY_TYPES },
            options: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['database_id', 'key', 'type'],
        },
      },
      {
        name: 'create_database_record',
        description: 'Add a new row/record to an existing database. Also creates the linked page.',
        parameters: {
          type: 'OBJECT',
          properties: {
            database_id: { type: 'STRING' },
            title: { type: 'STRING', description: 'Value for the title property / linked page title' },
            properties: {
              type: 'OBJECT',
              description:
                'Key/value pairs keyed by the schema property keys (excluding the ' +
                'title property). select = string; multi_select/people = array of strings.',
            },
          },
          required: ['database_id', 'title'],
        },
      },
      {
        name: 'list_databases',
        description:
          'List existing databases in this workspace with their schema. Call this ' +
          'before creating records or properties if you do not already know the ' +
          'database_id (e.g. the user said "add it to the CRM").',
        parameters: { type: 'OBJECT', properties: {} },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

function stampAuthor(user) {
  return {
    created_by_email: user.email,
    created_by_name: user.name || user.email,
    last_edited_by_email: user.email,
    last_edited_by_name: user.name || user.email,
  };
}

// Title-case a machine key for a fallback column label ("due_date" -> "Due Date").
function labelFromKey(key) {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Normalize one schema property to the app's shape: { key, name, type, options? }.
function normalizeProperty(p) {
  const out = { key: p.key, name: p.name || labelFromKey(p.key), type: p.type };
  if (Array.isArray(p.options) && p.options.length) out.options = p.options;
  return out;
}

// The four default views the app seeds for a new database, so it renders.
function defaultViews(dbId, orgId) {
  return [
    { name: 'Table', type: 'table', order: 0 },
    { name: 'Board', type: 'board', order: 1 },
    { name: 'List', type: 'list', order: 2 },
    { name: 'Gallery', type: 'gallery', order: 3 },
  ].map((v) => ({
    database_id: dbId,
    org_id: orgId,
    name: v.name,
    type: v.type,
    filters: [],
    sorts: [],
    hidden_props: [],
    order: v.order,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }));
}

// ---------------------------------------------------------------------------
// 3. Tool handlers — the actual Firestore writes, scoped to org_id + user.
// ---------------------------------------------------------------------------

const HANDLERS = {
  async create_page(args, ctx) {
    // FIX: the editor does JSON.parse(page.content || '[]'), so content must be
    // a JSON-encoded block array — a raw string throws and renders as empty.
    const blocks = [{
      id: Math.random().toString(36).slice(2, 9),
      type: 'paragraph',
      content: args.content || '',
    }];
    const ref = await db.collection('pages').add({
      title: args.title,
      org_id: ctx.orgId,
      icon: args.icon || '📄',
      content: JSON.stringify(blocks),
      parent_id: args.parent_id || null,
      is_deleted: false,
      is_template: false,
      ...stampAuthor(ctx.user),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return { page_id: ref.id, title: args.title };
  },

  async create_task(args, ctx) {
    // FIX: the app reads assignees via getAssignees() and the security rules /
    // member task view filter on `assignee_emails array-contains`. Writing only
    // the singular `assignee_email` means the task is invisible to a member in
    // their own board. Write all three shapes, like buildAssigneeFields().
    const email = args.assignee_email || '';
    const name = email ? (ctx.memberNames[email] || '') : '';
    const assignees = email ? [{ email, name }] : [];

    const ref = await db.collection('tasks').add({
      title: args.title,
      org_id: ctx.orgId,
      description: args.description || '',
      status: TASK_STATUSES.includes(args.status) ? args.status : 'To Do',
      priority: TASK_PRIORITIES.includes(args.priority) ? args.priority : 'Medium',
      assignees,
      assignee_emails: assignees.map((a) => a.email),
      assignee_email: email,
      assignee_name: name,
      due_date: args.due_date || null,
      effort: TASK_EFFORTS.includes(args.effort) ? args.effort : null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return { task_id: ref.id, title: args.title };
  },

  async create_database(args, ctx) {
    // FIX: normalize schema to { key, name, type, options } and guarantee
    // exactly one title property (the app keys the linked page off it).
    let schema = (args.schema || []).map(normalizeProperty);
    if (!schema.some((p) => p.type === 'title')) {
      schema = [{ key: 'title', name: 'Name', type: 'title' }, ...schema];
    }

    const ref = await db.collection('databases').add({
      name: args.name,
      org_id: ctx.orgId,
      schema,
      created_by_email: ctx.user.email,
      created_by_name: ctx.user.name || ctx.user.email,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // FIX: a database with no db_views doesn't render properly — seed the
    // same four default views the app creates through its own UI.
    const batch = db.batch();
    for (const view of defaultViews(ref.id, ctx.orgId)) {
      batch.set(db.collection('db_views').doc(), view);
    }
    await batch.commit();

    return { database_id: ref.id, name: args.name, properties: schema.map((p) => p.key) };
  },

  async add_database_property(args, ctx) {
    const dbRef = db.collection('databases').doc(args.database_id);
    const snap = await dbRef.get();
    if (!snap.exists || snap.data().org_id !== ctx.orgId) {
      throw new Error('Database not found in this workspace.');
    }
    const schema = snap.data().schema || [];
    schema.push(normalizeProperty(args));
    await dbRef.update({ schema, updated_at: FieldValue.serverTimestamp() });
    return { database_id: args.database_id, added: args.key };
  },

  async create_database_record(args, ctx) {
    const dbSnap = await db.collection('databases').doc(args.database_id).get();
    if (!dbSnap.exists || dbSnap.data().org_id !== ctx.orgId) {
      throw new Error('Database not found in this workspace.');
    }
    // Resolve the title property's key from the schema (it may not be 'title').
    const schema = dbSnap.data().schema || [];
    const titleKey = (schema.find((p) => p.type === 'title') || {}).key || 'title';

    // 1. Create the linked page first (each record is 1:1 with a Page).
    const pageRef = await db.collection('pages').add({
      title: args.title,
      icon: '📄',
      org_id: ctx.orgId,
      is_deleted: false,
      is_template: false,
      content: JSON.stringify([
        { id: Math.random().toString(36).slice(2, 9), type: 'paragraph', content: '' },
      ]),
      ...stampAuthor(ctx.user),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // 2. Create the record, pointing back at the page and database.
    const recordRef = await db.collection('records').add({
      database_id: args.database_id,
      page_id: pageRef.id,
      org_id: ctx.orgId,
      properties: { [titleKey]: args.title, ...(args.properties || {}) },
      is_sample: false,
      ...stampAuthor(ctx.user),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // 3. Backfill the page with its database/record linkage.
    await pageRef.update({ database_id: args.database_id, record_id: recordRef.id });

    return { record_id: recordRef.id, page_id: pageRef.id, title: args.title };
  },

  async list_databases(_args, ctx) {
    const snap = await db.collection('databases').where('org_id', '==', ctx.orgId).get();
    return snap.docs.map((d) => ({ id: d.id, name: d.data().name, schema: d.data().schema }));
  },
};

// ---------------------------------------------------------------------------
// 4. Org membership check — never let the model write to an org the caller
//    isn't actually a member of, regardless of what org_id it's told.
//    (Admin SDK bypasses security rules, so this is the ONLY authorization.)
// ---------------------------------------------------------------------------

async function loadMembership(orgId, email) {
  const orgSnap = await db.collection('organizations').doc(orgId).get();
  if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');
  const org = orgSnap.data();
  const members = org.members || [];
  const isMember = org.owner_email === email || members.some((m) => m.email === email);
  if (!isMember) throw new HttpsError('permission-denied', 'Not a member of this organization.');
  // email -> display name lookup so assigned tasks carry a name, not just an email.
  const memberNames = {};
  for (const m of members) if (m.email) memberNames[m.email] = m.full_name || m.name || '';
  return { memberNames };
}

// ---------------------------------------------------------------------------
// 5. The callable entry point.
// ---------------------------------------------------------------------------

exports.workspaceAgent = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { message, orgId } = request.data || {};
  if (!message || !orgId) throw new HttpsError('invalid-argument', 'message and orgId are required.');

  const userEmail = request.auth.token.email;
  if (!userEmail) throw new HttpsError('failed-precondition', 'No email on the signed-in account.');

  const { memberNames } = await loadMembership(orgId, userEmail);

  const ctx = {
    orgId,
    user: { email: userEmail, name: request.auth.token.name || userEmail },
    memberNames,
  };

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  const model = genAI.getGenerativeModel({
    model: AGENT_MODEL,
    tools: TOOLS,
    systemInstruction:
      'You are a workspace assistant for a Notion-style app. Use the provided tools to create pages, ' +
      'tasks, databases, and records on the user\'s behalf. Call list_databases first if you need a ' +
      'database_id you were not given. Do not ask the user follow-up questions — make reasonable ' +
      'choices and act. When building a database for a concept like a bug tracker or CRM, include ' +
      'sensible columns (e.g. Status and Priority as select properties with options). After acting, ' +
      'reply with a short plain-text confirmation of what you did.',
  });

  const chat = model.startChat();
  let result = await chat.sendMessage(message);

  // Track what actually got written so the client can refresh views / link out.
  const actions = [];

  // Loop: execute any function calls the model requests, feed results back,
  // until it returns a plain text answer (cap iterations as a safety net).
  for (let i = 0; i < 6; i++) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const responses = [];
    for (const call of calls) {
      const handler = HANDLERS[call.name];
      let output;
      try {
        output = handler ? await handler(call.args || {}, ctx) : { error: `Unknown tool ${call.name}` };
        if (!output.error && call.name !== 'list_databases') {
          actions.push({ tool: call.name, ...output });
        }
      } catch (err) {
        output = { error: err.message };
      }
      responses.push({ functionResponse: { name: call.name, response: output } });
    }
    result = await chat.sendMessage(responses);
  }

  return { reply: result.response.text(), actions };
});
