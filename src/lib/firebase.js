import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA7pRK0GeTT09PQ8Ui-nZYSoiqAqkB2Rpk",
  authDomain: "xponet-f6f56.firebaseapp.com",
  projectId: "xponet-f6f56",
  storageBucket: "xponet-f6f56.firebasestorage.app",
  messagingSenderId: "676894766537",
  appId: "1:676894766537:web:941595a5d3c8155ca7e418",
  measurementId: "G-3L5RKY7LYD",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app, "xponet");
setLogLevel("error");
export const storage = getStorage(app);
export default app;
