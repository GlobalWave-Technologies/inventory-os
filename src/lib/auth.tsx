import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authenticate, db, ensureDefaultAdmin, getUser, registerUser, resetPassword, type User } from "./db";

const SESSION_KEY = "veridian-user-id";

type AuthValue = {
  user: User | null | undefined;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  forgotPassword: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void ensureDefaultAdmin().finally(() => {
      setUserId(localStorage.getItem(SESSION_KEY));
      setReady(true);
    });
  }, []);

  const liveUser = useLiveQuery(() => (userId ? getUser(userId) : undefined), [userId]);

  useEffect(() => {
    if (ready && userId && liveUser === undefined) return;
    if (ready && userId && !liveUser) {
      localStorage.removeItem(SESSION_KEY);
      setUserId(null);
    }
  }, [ready, userId, liveUser]);

  const value = useMemo<AuthValue>(
    () => ({
      user: ready ? (userId ? liveUser : null) : undefined,
      isAdmin: liveUser?.role === "admin",
      login: async (email, password) => {
        const user = await authenticate(email, password);
        if (!user) return false;
        localStorage.setItem(SESSION_KEY, user.id);
        setUserId(user.id);
        return true;
      },
      signup: async (name, email, password) => {
        try {
          const user = await registerUser({ name, email, password });
          localStorage.setItem(SESSION_KEY, user.id);
          setUserId(user.id);
          return true;
        } catch {
          return false;
        }
      },
      forgotPassword: (email, password) => resetPassword(email, password),
      logout: () => {
        localStorage.removeItem(SESSION_KEY);
        setUserId(null);
      },
    }),
    [ready, userId, liveUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

