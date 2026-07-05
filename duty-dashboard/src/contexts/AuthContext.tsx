import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import type { User } from "firebase/auth";
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { StaffDoc, StaffRole } from "../types";

// ── Types ───────────────────────────────────────────────────────────────────

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: StaffRole;
}

interface AuthState {
  user: User | null;
  staff: StaffDoc | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    staff: null,
    loading: true,
    error: null,
  });

  // ── Auth state listener ─────────────────────────────────────────────────
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous profile listener
      unsubProfile?.();
      unsubProfile = undefined;

      if (!firebaseUser) {
        setState({ user: null, staff: null, loading: false, error: null });
        return;
      }

      // Listen to staff profile in real-time
      const staffRef = doc(db, "staff", firebaseUser.uid);
      unsubProfile = onSnapshot(
        staffRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Omit<StaffDoc, "uid">;
            setState({
              user: firebaseUser,
              staff: { uid: snap.id, ...data } as StaffDoc,
              loading: false,
              error: null,
            });
          } else {
            setState({
              user: firebaseUser,
              staff: null,
              loading: false,
              error: null,
            });
          }
        },
        (err) => {
          console.error("[Auth] profile listener error", err);
          setState((prev) => ({ ...prev, loading: false, error: err.message }));
        }
      );
    });

    return () => {
      unsubAuth();
      unsubProfile?.();
    };
  }, []);

  // ── Heartbeat: update lastSeen every 30s ────────────────────────────────
  useEffect(() => {
    if (!state.user) return;

    const updateHeartbeat = async () => {
      try {
        await updateDoc(doc(db, "staff", state.user!.uid), {
          lastSeen: serverTimestamp(),
        });
      } catch {
        // Ignore — doc may not exist yet during registration
      }
    };

    void updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 30_000);
    return () => clearInterval(interval);
  }, [state.user]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Create staff profile in Firestore
      await setDoc(doc(db, "staff", cred.user.uid), {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        status: "AVAILABLE",
        location: null,
        locationUpdatedAt: null,
        activeIncidentId: null,
        totalResolved: 0,
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    if (state.user) {
      try {
        await updateDoc(doc(db, "staff", state.user.uid), {
          status: "OFFLINE",
        });
      } catch {
        // Best-effort
      }
    }
    await signOut(auth);
  }, [state.user]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
