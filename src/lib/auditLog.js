import { db } from '@/lib/firebase';
import {
  collection, addDoc, getDocs, query, orderBy, limit,
  startAfter, where, serverTimestamp,
} from 'firebase/firestore';

// ─── Action constants ────────────────────────────────────────────────────────
// Use these string constants everywhere so filters and labels stay in sync.

export const AUDIT_ACTIONS = {
  PAGE_LOCK:             'page.lock',
  PAGE_UNLOCK:           'page.unlock',
  PAGE_DELETE:           'page.delete',
  PAGE_PERM_UPDATED:     'page.permissions_updated',

  DB_PROP_ADD:           'db.schema.property_add',
  DB_PROP_EDIT:          'db.schema.property_edit',
  DB_PROP_DELETE:        'db.schema.property_delete',

  MEMBER_INVITE:         'member.invite',
  MEMBER_REMOVE:         'member.remove',
  MEMBER_ROLE_CHANGE:    'member.role_change',
};

export const AUDIT_ACTION_LABELS = {
  [AUDIT_ACTIONS.PAGE_LOCK]:          'Locked page',
  [AUDIT_ACTIONS.PAGE_UNLOCK]:        'Unlocked page',
  [AUDIT_ACTIONS.PAGE_DELETE]:        'Deleted page',
  [AUDIT_ACTIONS.PAGE_PERM_UPDATED]:  'Updated page permissions',
  [AUDIT_ACTIONS.DB_PROP_ADD]:        'Added property',
  [AUDIT_ACTIONS.DB_PROP_EDIT]:       'Edited property',
  [AUDIT_ACTIONS.DB_PROP_DELETE]:     'Deleted property',
  [AUDIT_ACTIONS.MEMBER_INVITE]:      'Invited member',
  [AUDIT_ACTIONS.MEMBER_REMOVE]:      'Removed member',
  [AUDIT_ACTIONS.MEMBER_ROLE_CHANGE]: 'Changed member role',
};

// ─── Write ───────────────────────────────────────────────────────────────────

/**
 * logAuditEvent — fire-and-forget write to audit_logs/{orgId}/events/{autoId}.
 * Never throws — failures are swallowed so the caller's main flow is unaffected.
 *
 * @param {string} orgId
 * @param {{
 *   actorUid:    string,
 *   actorName:   string,
 *   action:      string,       // one of AUDIT_ACTIONS values
 *   entityType:  string,       // 'page' | 'database' | 'member' | 'organization'
 *   entityId:    string,
 *   entityTitle: string,
 *   metadata?:   object,
 * }} event
 */
export async function logAuditEvent(orgId, event) {
  if (!orgId || !event?.action) return;
  try {
    await addDoc(collection(db, 'audit_logs', orgId, 'events'), {
      actorUid:    event.actorUid    ?? '',
      actorName:   event.actorName   ?? '',
      action:      event.action,
      entityType:  event.entityType  ?? '',
      entityId:    event.entityId    ?? '',
      entityTitle: event.entityTitle ?? '',
      metadata:    event.metadata    ?? {},
      timestamp:   serverTimestamp(),
    });
  } catch (err) {
    console.warn('[audit] Failed to log event:', err);
  }
}

// ─── Read ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

/**
 * fetchAuditPage — loads one page of audit events with optional filters.
 *
 * @param {string}         orgId
 * @param {{
 *   actionFilter?: string,        // filter to a single action string
 *   dateFrom?:     Date|null,
 *   dateTo?:       Date|null,
 *   cursor?:       object|null,   // Firestore DocumentSnapshot for startAfter
 * }} opts
 * @returns {{ events: object[], nextCursor: object|null }}
 */
export async function fetchAuditPage(orgId, { actionFilter, dateFrom, dateTo, cursor } = {}) {
  const constraints = [orderBy('timestamp', 'desc'), limit(PAGE_SIZE)];

  if (actionFilter) {
    constraints.push(where('action', '==', actionFilter));
  }
  if (dateFrom) {
    constraints.push(where('timestamp', '>=', dateFrom));
  }
  if (dateTo) {
    // dateTo is end-of-day
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    constraints.push(where('timestamp', '<=', end));
  }
  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, 'audit_logs', orgId, 'events'), ...constraints);
  const snap = await getDocs(q);

  const events = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      // Convert Firestore Timestamp → JS Date
      timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null,
      _snap: d,  // keep raw snapshot for cursor pagination
    };
  });

  const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
  return { events, nextCursor };
}
