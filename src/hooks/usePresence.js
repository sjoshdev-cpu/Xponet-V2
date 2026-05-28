import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const TWO_MINUTES_MS = 2 * 60 * 1000;

/**
 * usePresence(pageId)
 *
 * Writes the current user's presence to:
 *   presence/{pageId}/viewers/{uid}
 *
 * Polls every 30 seconds to refresh own doc + fetch other viewers.
 * Returns:
 *   viewers — [{ email, name, uid }] — other active viewers (seen < 2 min ago)
 */
export function usePresence(pageId) {
  const { user } = useWorkspace();
  const [viewers, setViewers] = useState([]);

  useEffect(() => {
    if (!pageId || !user?.uid) return;

    const presenceRef = doc(db, 'presence', pageId, 'viewers', user.uid);

    const writePresence = () => {
      setDoc(presenceRef, {
        email: user.email,
        name: user.full_name || user.email,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    };

    const fetchViewers = async () => {
      try {
        const snap = await getDocs(collection(db, 'presence', pageId, 'viewers'));
        const cutoff = Date.now() - TWO_MINUTES_MS;
        const active = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((v) => {
            const ts = v.lastSeen?.toDate?.()?.getTime?.() ?? 0;
            return ts > cutoff && v.email !== user.email;
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
  }, [pageId, user?.uid, user?.email, user?.full_name]);

  return { viewers };
}
