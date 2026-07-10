import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
} from 'firebase/auth';

const AuthContext = createContext();

const KNOWN_ACCOUNTS_KEY = 'xponet-known-accounts';

/**
 * Accounts that have signed in on this device (email + display name only —
 * no credentials). Firebase Auth holds a single active session, so the
 * workspace switcher lists these and "switching" re-authenticates as them.
 */
export function getKnownAccounts() {
  try {
    return JSON.parse(localStorage.getItem(KNOWN_ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function rememberAccount(firebaseUser) {
  if (!firebaseUser?.email) return;
  const accounts = getKnownAccounts().filter((a) => a.email !== firebaseUser.email);
  accounts.unshift({ email: firebaseUser.email, name: firebaseUser.displayName || '' });
  localStorage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 5)));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Reactively track Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthError(firebaseUser ? null : { type: 'auth_required' });
      setIsLoadingAuth(false);
      if (firebaseUser) rememberAccount(firebaseUser);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const loginWithGoogle = () =>
    signInWithPopup(auth, new GoogleAuthProvider());

  const register = async (email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    return credential;
  };

  const logout = () => signOut(auth);

  const sendPasswordReset = (email) =>
    sendPasswordResetEmail(auth, email);

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      authError,
      login,
      loginWithGoogle,
      register,
      logout,
      sendPasswordReset,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);