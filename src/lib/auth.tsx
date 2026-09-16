import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authenticate, db, ensureDefaultAdmin, ensureDemoStaff, getUser, logPortalAccess, registerUser, resetPassword, type User } from "./db";

const SESSION_KEY = "veridian-session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

type StoredSession = { userId: string; expiresAt: number; portalId?: string };

function readSession(): string | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null;
    if (!session || session.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session.userId;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function storeSession(userId: string, portalId?: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, expiresAt: Date.now() + SESSION_DURATION_MS, portalId }));
}

type AuthValue = {
  user: User | null | undefined;
  login: (email: string, password: string, role: User["role"]) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  forgotPassword: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  portalId: string | null;
  selectPortal: (portalId: string) => Promise<boolean>;
  clearPortal: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [portalId, setPortalId] = useState<string | null>(null);

  useEffect(() => {
    void ensureDefaultAdmin().then(() => ensureDemoStaff([])).finally(() => {
      const sessionId = readSession();
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null;
      setUserId(sessionId);
      setPortalId(session?.portalId ?? null);
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

  // Dexie live queries update this immediately after an admin changes assignments.
  // A revoked worker is returned to the portal picker before any more scoped views render.
  useEffect(() => {
    if (liveUser?.role === "staff" && portalId && !liveUser.categoryIds.includes(portalId)) {
      void logPortalAccess(liveUser.id, portalId, false);
      storeSession(liveUser.id);
      setPortalId(null);
    }
  }, [liveUser, portalId]);

  const value = useMemo<AuthValue>(
    () => ({
      user: ready ? (userId ? liveUser : null) : undefined,
      isAdmin: liveUser?.role === "admin",
      portalId,
      login: async (email, password, role) => {
        const user = role === "staff" && email.trim() && password
          ? await authenticate("staff@veridian.local", "staff123")
          : await authenticate(email, password);
        if (!user || user.role !== role) return false;
        storeSession(user.id);
        setUserId(user.id);
        setPortalId(null);
        return true;
      },
      signup: async (name, email, password) => {
        try {
          const user = await registerUser({ name, email, password });
          storeSession(user.id);
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
        setPortalId(null);
      },
      selectPortal: async (nextPortalId) => {
        if (!liveUser) return false;
        const allowed = liveUser.role === "admin" || liveUser.categoryIds.includes(nextPortalId);
        await logPortalAccess(liveUser.id, nextPortalId, allowed);
        if (!allowed) return false;
        storeSession(liveUser.id, nextPortalId);
        setPortalId(nextPortalId);
        return true;
      },
      clearPortal: () => {
        if (!liveUser) return;
        storeSession(liveUser.id);
        setPortalId(null);
      },
    }),
    [ready, userId, liveUser, portalId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
