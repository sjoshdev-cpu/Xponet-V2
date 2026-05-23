import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
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
     */
    async filter(queryObj = {}) {
      const constraints = Object.entries(queryObj).map(([key, value]) =>
        where(key, '==', value)
      );
      const q = constraints.length ? query(colRef(), ...constraints) : colRef();
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => convertTimestamps({ id: d.id, ...d.data() }));
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
     * delete(id) — permanently removes a document.
     */
    async delete(id) {
      await deleteDoc(doc(db, collectionName, id));
    },
  };
}

export const Page         = makeEntity('pages');
export const Task         = makeEntity('tasks');
export const Comment      = makeEntity('comments');
export const Notification = makeEntity('notifications');
export const Organization = makeEntity('organizations');

export default {
  entities: { Page, Task, Comment, Notification, Organization },
};
