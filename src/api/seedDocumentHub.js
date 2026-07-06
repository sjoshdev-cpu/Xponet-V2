import { Database, DatabaseView, DatabaseRecord, Page } from './firestoreClient.js';

// ─── Schema ────────────────────────────────────────────────────────────────

const DB_SCHEMA = [
  { key: 'title',            name: 'Doc name',         type: 'title' },
  {
    key: 'category',
    name: 'Category',
    type: 'select',
    options: ['strategy doc', 'proposal', 'customer research'],
  },
  { key: 'reviewers',        name: 'Reviewers',         type: 'people' },
  { key: 'created_time',     name: 'Created time',      type: 'created_time' },
  { key: 'created_by',       name: 'Created by',        type: 'created_by' },
  { key: 'last_edited_time', name: 'Last updated time', type: 'last_edited_time' },
  { key: 'last_edited_by',   name: 'Last edited by',    type: 'last_edited_by' },
];

const DEFAULT_VISIBLE_COLUMNS = [
  'category',
  'created_by',
  'created_time',
  'last_edited_by',
  'last_edited_time',
];

// ─── Sample records ────────────────────────────────────────────────────────

const SAMPLE_RECORDS = [
  {
    title: 'Strategy doc',
    category: 'strategy doc',
    icon: '📊',
    contentBlocks: [
      { id: '1', type: 'heading1', content: 'Strategy doc' },
      {
        id: '2',
        type: 'paragraph',
        content:
          'Use this document to outline your team\'s strategy, goals, and key initiatives for the quarter.',
      },
    ],
  },
  {
    title: 'Proposal',
    category: 'proposal',
    icon: '📄',
    contentBlocks: [
      { id: '1', type: 'heading1', content: 'Proposal' },
      {
        id: '2',
        type: 'paragraph',
        content:
          'Draft your proposals here. Include the problem statement, proposed solution, and estimated timeline.',
      },
    ],
  },
  {
    title: 'Customer research',
    category: 'customer research',
    icon: '🔍',
    contentBlocks: [
      { id: '1', type: 'heading1', content: 'Customer research' },
      {
        id: '2',
        type: 'paragraph',
        content:
          'Capture insights from customer interviews, surveys, and feedback sessions in one place.',
      },
    ],
  },
];

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * findDocumentHub(orgId)
 * Returns the existing "Document Hub" database for an org, or null.
 */
export async function findDocumentHub(orgId) {
  const databases = await Database.filter({ org_id: orgId });
  return databases.find((db) => db.name === 'Document Hub') ?? null;
}

/**
 * seedHubViews(dbId, orgId, userEmail)
 *
 * Idempotently creates the 3 canonical Document Hub views for a database that
 * already exists. No-op if views are already present.
 *
 * @param {string} dbId
 * @param {string} orgId
 * @param {string} [userEmail]
 */
export async function seedHubViews(dbId, orgId, userEmail = '') {
  const existing = await DatabaseView.filter({ database_id: dbId });
  if (existing.length) return null;

  const viewBase = { database_id: dbId, org_id: orgId, type: 'table' };

  await Promise.all([
    DatabaseView.create({
      ...viewBase,
      name: 'All Docs',
      filters: [],
      sorts: [{ propertyKey: 'last_edited_time', direction: 'desc' }],
      groupBy: null,
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      order: 0,
    }),
    DatabaseView.create({
      ...viewBase,
      name: 'My Docs',
      filters: [{ propertyKey: 'created_by', op: 'eq', value: userEmail }],
      sorts: [{ propertyKey: 'last_edited_time', direction: 'desc' }],
      groupBy: null,
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      order: 1,
    }),
    DatabaseView.create({
      ...viewBase,
      name: 'By Category',
      filters: [],
      sorts: [{ propertyKey: 'category', direction: 'asc' }],
      groupBy: { propertyKey: 'category' },
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      order: 2,
    }),
  ]);
}

const DEFAULT_DATABASE_VIEWS = [
  { name: 'Table', type: 'table', order: 0 },
  { name: 'Board', type: 'board', order: 1 },
  { name: 'List', type: 'list', order: 2 },
  { name: 'Gallery', type: 'gallery', order: 3 },
];

/**
 * seedDatabaseViews(dbId, orgId)
 *
 * Creates a default set of views for any database that has none.
 * This is idempotent and only runs when the database has zero saved views.
 *
 * @param {string} dbId
 * @param {string} orgId
 */
export async function seedDatabaseViews(dbId, orgId) {
  const existing = await DatabaseView.filter({ database_id: dbId });
  if (existing.length) return null;

  await Promise.all(DEFAULT_DATABASE_VIEWS.map((view) =>
    DatabaseView.create({
      database_id: dbId,
      org_id: orgId,
      name: view.name,
      type: view.type,
      filters: [],
      sorts: [],
      hidden_props: [],
      order: view.order,
    })
  ));
}

/**
 * seedHubRecords(dbId, orgId, userEmail)
 *
 * Idempotently creates the 3 sample records (and their backing Pages) for a
 * database that already exists. No-op if any records are already present.
 *
 * @param {string} dbId
 * @param {string} orgId
 * @param {string} [userEmail]
 */
export async function seedHubRecords(dbId, orgId, userEmail = '') {
  const existing = await DatabaseRecord.filter({ database_id: dbId });
  if (existing.length) return null;

  for (const sample of SAMPLE_RECORDS) {
    const page = await Page.create({
      title: sample.title,
      icon: sample.icon,
      org_id: orgId,
      is_sample: true,
      content: JSON.stringify(sample.contentBlocks),
    });

    const record = await DatabaseRecord.create({
      database_id: dbId,
      page_id: page.id,
      org_id: orgId,
      properties: {
        title: sample.title,
        category: sample.category,
        reviewers: [],
      },
      created_by_email: userEmail,
      created_by_name: '',
      last_edited_by_email: userEmail,
      last_edited_by_name: '',
      is_sample: true,
    });

    // Link page → record so PageEditor can find the record without an extra query
    await Page.update(page.id, { record_id: record.id });
  }
}

/**
 * seedDocumentHub(orgId, userEmail)
 *
 * Idempotently creates:
 *   1. A "Document Hub" database with the canonical schema
 *   2. Three default views via seedHubViews (All Docs, My Docs, By Category)
 *   3. Three sample records via seedHubRecords, each backed by a new Page
 *
 * Returns null immediately if the database already exists for this org.
 *
 * @param {string} orgId
 * @param {string} [userEmail] – stored as the filter value in the "My Docs" view
 * @returns {Promise<object|null>} The created database, or null if already present.
 */
export async function seedDocumentHub(orgId, userEmail = '') {
  // ── Idempotency guard ───────────────────────────────────────────────────
  const existing = await findDocumentHub(orgId);
  if (existing) return null;

  // ── 1. Database ─────────────────────────────────────────────────────────
  const database = await Database.create({
    name: 'Document Hub',
    icon: '📚',
    description: 'Create and collaborate on documents in one place.',
    schema: DB_SCHEMA,
    org_id: orgId,
  });

  // ── 2. Views ────────────────────────────────────────────────────────────
  await seedHubViews(database.id, orgId, userEmail);

  // ── 3. Sample records ───────────────────────────────────────────────────
  await seedHubRecords(database.id, orgId, userEmail);

  return database;
}

/**
 * deleteSampleData(orgId)
 *
 * Bulk-removes all records + pages marked with is_sample: true for this org.
 * Useful for "Delete sample pages" settings action.
 *
 * @param {string} orgId
 */
export async function deleteSampleData(orgId) {
  const [sampleRecords, samplePages] = await Promise.all([
    DatabaseRecord.filter({ org_id: orgId, is_sample: true }),
    Page.filter({ org_id: orgId, is_sample: true }),
  ]);

  await Promise.all([
    ...sampleRecords.map((r) => DatabaseRecord.delete(r.id)),
    ...samplePages.map((p) => Page.delete(p.id)),
  ]);

  return { deletedRecords: sampleRecords.length, deletedPages: samplePages.length };
}
