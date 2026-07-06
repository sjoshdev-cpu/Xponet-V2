import { useEffect, useRef, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  doc,
  collection,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const TWO_MINUTES_MS = 2 * 60 * 1000;

/**
 * usePresence(entityType, entityId, status?)
 *
 * Writes the current user's presence to:
 *   presence/{orgId}/{entityType}/{entityId}/users/{uid}
 *
 * Writes on mount, refreshes every 30 s, and deletes on unmount.
 * Filters out stale entries (lastSeen > 2 min ago).
 *
 * @param {string} entityType  - e.g. 'page', 'ticket', 'database'
 * @param {string} entityId    - the entity's Firestore ID
 * @param {'viewing'|'editing'} [status='viewing']
 * @returns {{ viewers: Array<{uid, displayName, photoURL, email, status}> }}
 */
export function usePresence(entityType, entityId, status = 'viewing') {
  const { user, currentOrganization } = useWorkspace();
  const orgId = currentOrganization?.id;
  const [viewers, setViewers] = useState([]);

  // Always-current status ref so the interval can read the latest value.
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (!entityId || !entityType || !user?.uid || !orgId) return;

    const presenceRef = doc(db, 'presence', orgId, entityType, entityId, 'users', user.uid);
    const viewersCol  = collection(db, 'presence', orgId, entityType, entityId, 'users');

    const writePresence = () => {
      const fbUser = auth.currentUser;
      setDoc(presenceRef, {
        displayName: fbUser?.displayName || user.full_name || user.email || '',
        photoURL:    fbUser?.photoURL    ?? null,
        email:       user.email,
        lastSeen:    serverTimestamp(),
        status:      statusRef.current,
      }).catch(() => {});
    };

    const fetchViewers = async () => {
      try {
        const snap = await getDocs(viewersCol);
        const cutoff = Date.now() - TWO_MINUTES_MS;
        const active = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(v => {
            const ts = v.lastSeen?.toDate?.()?.getTime?.() ?? 0;
            return ts > cutoff && v.uid !== user.uid;
          });
        setViewers(active);
      } catch (_) {}
    };

    writePresence();
    fetchViewers();

    const interval = setInterval(() => {
      writePresence();
      fetchViewers();
    }, 30_000);

    return () => {
      clearInterval(interval);
      deleteDoc(presenceRef).catch(() => {});
    };
    // orgId and uid are stable for a session; entityType/entityId drive re-runs.
  }, [entityType, entityId, user?.uid, orgId]);

  return { viewers };
}
