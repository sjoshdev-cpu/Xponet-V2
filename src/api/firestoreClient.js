import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';

function makeEntity(collectionName) {
  const colRef = () => collection(db, collectionName);

  const convertTimestamps = (data) => {
    const result = { ...data };
    for (const key in result) {
      if (result[key]?.toDate) {
        result[key] = result[key].toDate();
      }
    }
    return result;
  };

  return {
    /**
     * filter(queryObj) — converts a flat { key: value } object into Firestore
     * where() clauses. Returns an array of { id, ...data } documents.
     * Pass { field: { arrayContains: value } } for an array-contains clause
     * (e.g. filtering tasks where assignee_emails contains the current user).
     */
    async filter(queryObj = {}) {
      const constraints = Object.entries(queryObj).map(([key, value]) => {
        if (value && typeof value === 'object' && 'arrayContains' in value) {
          return where(key, 'array-contains', value.arrayContains);
        }
        return where(key, '==', value);
      });
      const q = constraints.length ? query(colRef(), ...constraints) : colRef();
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => convertTimestamps({ id: d.id, ...d.data() }));
    },

    /**
     * listen(queryObj, onData, onError?) — realtime version of filter().
     * Subscribes via onSnapshot and invokes onData with the full mapped
     * result set on every change. Returns the unsubscribe function.
     */
    listen(queryObj = {}, onData, onError) {
      const constraints = Object.entries(queryObj).map(([key, value]) => {
        if (value && typeof value === 'object' && 'arrayContains' in value) {
          return where(key, 'array-contains', value.arrayContains);
        }
        return where(key, '==', value);
      });
      const q = constraints.length ? query(colRef(), ...constraints) : colRef();
      return onSnapshot(
        q,
        (snapshot) => onData(snapshot.docs.map((d) => convertTimestamps({ id: d.id, ...d.data() }))),
        onError || ((err) => console.error(`[listen:${collectionName}]`, err)),
      );
    },

    /**
     * get(id) — fetches a single document by id.
     * Returns { id, ...data } or null if not found.
     */
    async get(id) {
      const snapshot = await getDoc(doc(db, collectionName, id));
      if (!snapshot.exists()) return null;
      return convertTimestamps({ id: snapshot.id, ...snapshot.data() });
    },

    /**
     * create(data) — adds a new document with server-side timestamps.
     * Returns the new document as { id, ...data }.
     */
    async create(data) {
      const payload = {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };
      const ref = await addDoc(colRef(), payload);
      return { id: ref.id, ...data };
    },

    /**
     * update(id, data) — merges data into an existing document and
     * refreshes updated_at.
     */
    async update(id, data) {
      const ref = doc(db, collectionName, id);
      await updateDoc(ref, { ...data, updated_at: serverTimestamp() });
    },

    /**
     * upsert(id, data) — creates or merges a document at a specific, known id
     * (unlike create(), which always generates a random id). Useful for
     * "one doc per org" style entities, e.g. reminder_configs/{orgId}.
     */
    async upsert(id, data) {
      const ref = doc(db, collectionName, id);
      await setDoc(ref, { ...data, updated_at: serverTimestamp() }, { merge: true });
      return { id, ...data };
    },

    /**
     * delete(id) — permanently removes a document.
     */
    async delete(id) {
      await deleteDoc(doc(db, collectionName, id));
    },
  };
}

export const Page         = makeEntity('pages');
export const Task         = makeEntity('tasks');
export const Ticket       = makeEntity('tickets');
export const Comment      = makeEntity('comments');
export const Notification = makeEntity('notifications');
export const Organization = makeEntity('organizations');
export const Database     = makeEntity('databases');
export const DatabaseRecord = makeEntity('records');
export const DatabaseView = makeEntity('db_views');
export const ReminderConfig = makeEntity('reminder_configs');
// Outbound email queue — client may only create (see firestore.rules); the
// scheduled GitHub Action drains it and actually sends via SMTP.
export const Mail = makeEntity('mail');

/**
 * withLastEditedBy(payload, user) — wraps any Page update payload with
 * last_edited_by_email and last_edited_by_name so every write carries
 * attribution without repeating the fields at each call site.
 *
 * Usage:
 *   await Page.update(id, withLastEditedBy({ is_locked: true }, user));
 */
export function withLastEditedBy(payload, user) {
  return {
    ...payload,
    last_edited_by_email: user?.email || '',
    last_edited_by_name: user?.full_name || user?.email || '',
  };
}

/**
 * Per-user profile metadata (pinned pages, recently-viewed pages) — separate
 * from Firebase Auth itself, stored in its own collection keyed by uid since
 * it's personal to the user rather than tied to any one org.
 */

export async function getUserProfile(uid) {
  if (!uid) return {};
  const snap = await getDoc(doc(db, 'user_profiles', uid));
  if (!snap.exists()) return {};
  return { id: snap.id, ...snap.data() };
}

export async function toggleUserPinnedPage(uid, pageId) {
  const ref = doc(db, 'user_profiles', uid);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().pinnedPages || []) : [];
  const isPinned = current.includes(pageId);
  await setDoc(ref, {
    pinnedPages: isPinned ? arrayRemove(pageId) : arrayUnion(pageId),
    updated_at: serverTimestamp(),
  }, { merge: true });
  return { pinned: !isPinned };
}

const MAX_RECENT_PAGES = 20;

/**
 * addUserRecentPage(uid, pageId) — records a page visit for the "Recently
 * edited" list on Home. Keeps `recentPages` ordered most-recent-first (Home
 * renders it as-is, unsorted) and capped so it can't grow unbounded.
 */
export async function addUserRecentPage(uid, pageId) {
  if (!uid || !pageId) return;
  const ref = doc(db, 'user_profiles', uid);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().recentPages || []) : [];
  const next = [pageId, ...current.filter((id) => id !== pageId)].slice(0, MAX_RECENT_PAGES);
  await setDoc(ref, { recentPages: next, updated_at: serverTimestamp() }, { merge: true });
}

/**
 * Backlinks — "what links to this page". Stored as a subcollection on the
 * *target* page (pages/{targetId}/backlinks/{sourcePageId}) rather than a
 * single array field, so rendering one page's backlinks is a single
 * subcollection query instead of a scan over every page in the org.
 *
 * Page-ref chips are inserted into block HTML by InlineRefDropdown as:
 *   <a data-ref-type="page-ref" data-page-id="{id}" ...>
 * so extracting them is a matter of scanning that HTML for the attribute.
 */

const PAGE_REF_ID_RE = /data-ref-type="page-ref"[^>]*data-page-id="([^"]+)"/g;

/**
 * extractPageRefsFromBlocks(blocks) — scans every block's HTML content
 * (including table cells and nested toggle children) for inline page-ref
 * chips and returns the de-duplicated list of target page ids referenced
 * anywhere on the page.
 */
export function extractPageRefsFromBlocks(blocks) {
  const ids = new Set();

  const scanHtml = (html) => {
    if (!html) return;
    PAGE_REF_ID_RE.lastIndex = 0;
    let match;
    while ((match = PAGE_REF_ID_RE.exec(html))) ids.add(match[1]);
  };

  const walk = (list) => {
    for (const block of list || []) {
      if (!block) continue;
      scanHtml(block.content);
      if (Array.isArray(block.rows)) {
        for (const row of block.rows) for (const cell of row) scanHtml(cell);
      }
      if (Array.isArray(block.children)) walk(block.children);
    }
  };
  walk(blocks);

  return Array.from(ids);
}

/**
 * syncBacklinks(...) — writes/removes the backlink entries created by one
 * save. PageEditor diffs its own outgoing_refs before/after each save and
 * passes only what changed, so this only ever touches the target pages that
 * actually gained or lost a reference.
 */
export async function syncBacklinks({ sourcePageId, sourceTitle, sourceIcon, addedTargetIds = [], removedTargetIds = [] }) {
  await Promise.all([
    ...addedTargetIds.map((targetId) =>
      setDoc(doc(db, 'pages', targetId, 'backlinks', sourcePageId), {
        sourcePageId,
        sourceTitle: sourceTitle || 'Untitled',
        sourceIcon: sourceIcon || '📄',
        updated_at: serverTimestamp(),
      })
    ),
    ...removedTargetIds.map((targetId) =>
      deleteDoc(doc(db, 'pages', targetId, 'backlinks', sourcePageId))
    ),
  ]);
}

/**
 * getBacklinks(pageId) — every page that currently links to `pageId`.
 */
export async function getBacklinks(pageId) {
  if (!pageId) return [];
  const snap = await getDocs(collection(db, 'pages', pageId, 'backlinks'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Row "body" content (rich block-based content below a record's properties,
 * shown in RecordModal). Stored directly on the record's own document in
 * `records` (as a `body` array field) rather than a separate collection —
 * it's just another field on the same row, and reuses the existing
 * records/{id} security rule rather than needing a new one.
 */

export async function getDatabaseRowBody(databaseId, recordId) {
  const snap = await getDoc(doc(db, 'records', recordId));
  if (!snap.exists()) return { body: [] };
  const data = snap.data();
  return { body: Array.isArray(data.body) ? data.body : [] };
}

export async function setDatabaseRowBody(databaseId, recordId, { body }) {
  await updateDoc(doc(db, 'records', recordId), { body, updated_at: serverTimestamp() });
  return { body };
}

/**
 * Row templates — lets a user save a Document Hub row's properties/body as a
 * reusable starting point for future rows. Stored in their own top-level
 * `db_row_templates` collection (not nested under databases/{id}, so it can
 * be listed with a simple query). Each template also carries the parent
 * database's org_id, purely so it can be secured the same way as every
 * other collection (see isOrgMember() in firestore.rules) — the client
 * itself always looks templates up by database_id, never by org_id.
 */

function convertDocTimestamps(data) {
  const result = { ...data };
  for (const key in result) {
    if (result[key]?.toDate) result[key] = result[key].toDate();
  }
  return result;
}

export async function createDatabaseRowTemplate(databaseId, templateName, templateData) {
  const dbSnap = await getDoc(doc(db, 'databases', databaseId));
  const orgId = dbSnap.exists() ? dbSnap.data().org_id : null;

  const payload = {
    ...templateData,
    template_name: templateName,
    database_id: databaseId,
    org_id: orgId,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'db_row_templates'), payload);
  return { id: ref.id, ...payload };
}

export async function getDatabaseRowTemplates(databaseId) {
  const q = query(collection(db, 'db_row_templates'), where('database_id', '==', databaseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => convertDocTimestamps({ id: d.id, ...d.data() }));
}

export async function deleteDatabaseRowTemplate(databaseId, templateId) {
  await deleteDoc(doc(db, 'db_row_templates', templateId));
}

export default {
  entities: { Page, Task, Ticket, Comment, Notification, Organization, Database, DatabaseRecord, DatabaseView, ReminderConfig },
};
