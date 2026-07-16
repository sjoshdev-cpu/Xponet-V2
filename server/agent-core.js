/**
 * Xponet Workspace Agent — core logic (transport-agnostic).
 *
 * This is the same agent brain that could run in a Cloud Function, factored
 * out so it can run as a plain Node process on the GCP VM (and locally) —
 * NO Firebase Blaze plan required. server/index.js wraps this in an Express
 * endpoint and verifies the caller's Firebase ID token.
 *
 * All the "// FIX:" comments mark corrections that make the agent's writes
 * match the app's real data shapes (see functions/agent.js for the Cloud
 * Function equivalent — keep the two in sync if you edit tool behavior).
 */

const { FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Enums kept in sync with the app (TaskTable badges, DB property types).
const TASK_STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const TASK_EFFORTS = ['XS', 'S', 'M', 'L', 'XL'];
const PROPERTY_TYPES = [
  'title', 'text', 'select', 'multi_select', 'people', 'date', 'checkbox',
  'number', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by',
];

// ---------------------------------------------------------------------------
// Tool declarations
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
// Helpers
// ---------------------------------------------------------------------------

function stampAuthor(user) {
  return {
    created_by_email: user.email,
    created_by_name: user.name || user.email,
    last_edited_by_email: user.email,
    last_edited_by_name: user.name || user.email,
  };
}

function labelFromKey(key) {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function normalizeProperty(p) {
  const out = { key: p.key, name: p.name || labelFromKey(p.key), type: p.type };
  if (Array.isArray(p.options) && p.options.length) out.options = p.options;
  return out;
}

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
// Tool handlers (bound to a Firestore instance)
// ---------------------------------------------------------------------------

function makeHandlers(db) {
  return {
    async create_page(args, ctx) {
      // FIX: the editor does JSON.parse(page.content || '[]'), so content must
      // be a JSON-encoded block array — a raw string throws and renders empty.
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
      // FIX: app reads assignees[] and filters the member task view + rules on
      // assignee_emails array-contains. Write all three shapes.
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
      // FIX: normalize schema and guarantee exactly one title property.
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

      // FIX: seed default views so the database renders.
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
      const schema = dbSnap.data().schema || [];
      const titleKey = (schema.find((p) => p.type === 'title') || {}).key || 'title';

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

      await pageRef.update({ database_id: args.database_id, record_id: recordRef.id });
      return { record_id: recordRef.id, page_id: pageRef.id, title: args.title };
    },

    async list_databases(_args, ctx) {
      const snap = await db.collection('databases').where('org_id', '==', ctx.orgId).get();
      return snap.docs.map((d) => ({ id: d.id, name: d.data().name, schema: d.data().schema }));
    },
  };
}

// ---------------------------------------------------------------------------
// Membership check — the ONLY authorization (Admin SDK bypasses rules).
// ---------------------------------------------------------------------------

async function loadMembership(db, orgId, email) {
  const orgSnap = await db.collection('organizations').doc(orgId).get();
  if (!orgSnap.exists) {
    const e = new Error('Organization not found.'); e.status = 404; throw e;
  }
  const org = orgSnap.data();
  const members = org.members || [];
  const isMember = org.owner_email === email || members.some((m) => m.email === email);
  if (!isMember) {
    const e = new Error('Not a member of this organization.'); e.status = 403; throw e;
  }
  const memberNames = {};
  for (const m of members) if (m.email) memberNames[m.email] = m.full_name || m.name || '';
  return { memberNames };
}

// ---------------------------------------------------------------------------
// The agent loop
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION =
  'You are a workspace assistant for a Notion-style app. Use the provided tools to create pages, ' +
  'tasks, databases, and records on the user\'s behalf. Call list_databases first if you need a ' +
  'database_id you were not given. Do not ask the user follow-up questions — make reasonable ' +
  'choices and act. When building a database for a concept like a bug tracker or CRM, include ' +
  'sensible columns (e.g. Status and Priority as select properties with options). After acting, ' +
  'reply with a short plain-text confirmation of what you did.';

/**
 * runAgent({ db, apiKey, model, message, ctx }) -> { reply, actions }
 */
async function runAgent({ db, apiKey, model = 'gemini-2.5-flash', message, ctx }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const handlers = makeHandlers(db);
  const gemini = genAI.getGenerativeModel({
    model,
    tools: TOOLS,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const chat = gemini.startChat();
  let result = await chat.sendMessage(message);
  const actions = [];

  for (let i = 0; i < 6; i++) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const responses = [];
    for (const call of calls) {
      const handler = handlers[call.name];
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
}

module.exports = { TOOLS, makeHandlers, loadMembership, runAgent };
