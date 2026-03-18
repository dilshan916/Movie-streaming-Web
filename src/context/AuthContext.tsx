import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, displayName: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isBanned: false,
  isAdmin: false,
  signIn: async () => {},
  signUp: async () => {},
  signOutUser: async () => {},
  resetPassword: async () => {},
  updateUserProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try {
          await setDoc(doc(db, "users", u.uid), { lastActive: serverTimestamp() }, { merge: true });
        } catch (e) {
          console.error("[Auth] Error updating lastActive", e);
        }
      } else {
        setIsBanned(false);
        setIsAdmin(false);
      }
    });
    return unsubscribe;
  }, []);

  // Real-time ban & admin check
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsBanned(!!data?.isBanned);
        setIsAdmin(!!data?.isAdmin);
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const signIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (email: string, pass: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, "users", cred.user.uid), {
      displayName,
      email,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    }, { merge: true });
  };

  const signOutUser = async () => {
    await signOut(auth);
    setIsBanned(false);
    setIsAdmin(false);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (displayName: string, photoURL?: string) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName, photoURL });
    setUser({ ...auth.currentUser } as User);
  };

  const value = useMemo(
    () => ({ user, loading, isBanned, isAdmin, signIn, signUp, signOutUser, resetPassword, updateUserProfile }),
    [user, loading, isBanned, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
