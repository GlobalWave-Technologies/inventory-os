import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, apiPost, apiRequest, clearTokens, refreshTokens, setAccessToken } from "./api";
import { wipeLegacyLocalData } from "./legacy";

export type UserRole = "admin" | "manager" | "staff";
export type User = { id: string; name: string; email: string; role: UserRole };

const SESSION_KEY = "stockline-session";

export type Branch = { id: string; name: string; type?: string };
export type SessionUser = User & {
  branches: Branch[];
  branchIds: string[];
  managersEnabled: boolean;
  isSuperAdmin: boolean;
  phone?: string;
};

// What GET /me returns once mapResponseKeys has turned snake_case into camelCase.
type ApiMe = {
  id?: number | string;
  email?: string;
  name?: string;
  phone?: string | null;
  role?: "super_admin" | "admin" | "manager" | "staff";
  managersEnabled?: boolean;
  locations?: { id: number | string; name: string; type: string }[];
};

type ApiLogin = { accessToken?: string };

type StoredSession = { branchId?: string };

function readSelectedBranch(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? ((JSON.parse(raw) as StoredSession).branchId ?? null) : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function storeSelectedBranch(branchId: string | null) {
  if (branchId) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ branchId }));
  else sessionStorage.removeItem(SESSION_KEY);
}

function normalizeMe(me: ApiMe): SessionUser {
  // The server calls a branch a "location" and its ids are numbers; the app uses strings.
  const branches: Branch[] = (me.locations ?? []).map((location) => ({
    id: String(location.id),
    name: location.name,
    type: location.type,
  }));
  const isSuperAdmin = me.role === "super_admin";
  const role: UserRole = me.role === undefined || me.role === "super_admin" ? (isSuperAdmin ? "admin" : "staff") : me.role;
  return {
    id: String(me.id ?? ""),
    name: me.name ?? "",
    email: me.email ?? "",
    ...(me.phone ? { phone: me.phone } : {}),
    // The screens only know admin / manager / staff; the super admin counts as an admin.
    role,
    isSuperAdmin,
    branches,
    branchIds: branches.map((branch) => branch.id),
    managersEnabled: me.managersEnabled ?? false,
  };
}

type AuthValue = {
  user: SessionUser | null | undefined;
  login: (email: string, password: string) => Promise<boolean>;
  activateAccount: (token: string, password: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  portalId: string | null;
  selectPortal: (portalId: string) => Promise<boolean>;
  clearPortal: () => void;
  managerSectionEnabled: boolean;
  managerSectionReady: boolean;
  setManagerSectionEnabled: (enabled: boolean) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [portalId, setPortalId] = useState<string | null>(null);
  const [managerSectionReady, setManagerSectionReady] = useState(false);

  useEffect(() => {
    setPortalId(readSelectedBranch());
    void wipeLegacyLocalData();

    // The access token is only in memory, so every page load starts by asking the server
    // (using the httpOnly cookie) for a fresh one. No cookie means nobody is signed in.
    void refreshTokens()
      .then((restored) => (restored ? apiRequest<ApiMe>("/me") : null))
      .then((result) => {
        setUser(result ? normalizeMe(result) : null);
        setManagerSectionReady(true);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          clearTokens();
          storeSelectedBranch(null);
          setPortalId(null);
        }
        setUser(null);
        setManagerSectionReady(true);
      });
  }, []);

  useEffect(() => {
    const expireSession = () => {
      clearTokens();
      storeSelectedBranch(null);
      setPortalId(null);
      setUser(null);
    };
    window.addEventListener("stockline:session-expired", expireSession);
    return () => window.removeEventListener("stockline:session-expired", expireSession);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      isAdmin: user?.role === "admin",
      managerSectionEnabled: user?.managersEnabled ?? false,
      managerSectionReady,
      setManagerSectionEnabled: async (enabled) => {
        if (user?.role !== "admin")
          throw new Error("Only administrators can change manager access.");
        await apiRequest("/settings", {
          method: "PATCH",
          body: JSON.stringify({ managersEnabled: enabled }),
        });
        const refreshed = normalizeMe(await apiRequest<ApiMe>("/me"));
        setUser(refreshed);
      },
      portalId,
      login: async (email, password) => {
        const tokens = await apiPost<ApiLogin>("/auth/login", { email, password });
        if (!tokens.accessToken) throw new Error("The server did not return a valid session.");
        setAccessToken(tokens.accessToken);
        const nextUser = normalizeMe(await apiRequest<ApiMe>("/me"));
        setUser(nextUser);
        setManagerSectionReady(true);
        storeSelectedBranch(null);
        setPortalId(null);
        return true;
      },
      activateAccount: async (token, password) => {
        await apiPost("/auth/activate", { token, password });
      },
      resetPassword: async (token, password) => {
        await apiPost("/auth/reset-password", { token, password });
      },
      logout: () => {
        // The cookie goes along automatically; the server revokes it and clears it.
        void apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
        clearTokens();
        storeSelectedBranch(null);
        setUser(null);
        setPortalId(null);
      },
      selectPortal: async (nextPortalId) => {
        if (!user) return false;
        const allowed = user.role === "admin" || user.branchIds.includes(nextPortalId);
        if (!allowed) return false;
        storeSelectedBranch(nextPortalId);
        setPortalId(nextPortalId);
        return true;
      },
      clearPortal: () => {
        storeSelectedBranch(null);
        setPortalId(null);
      },
      changePassword: async (currentPassword, nextPassword) => {
        if (!user) throw new Error("Sign in before changing your password.");
        await apiRequest("/me/password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword: nextPassword }),
        });
        const email = user.email;
        clearTokens();
        setUser(null);
        // The server just ended every session, so sign in again with the new password.
        const session = await apiPost<ApiLogin>("/auth/login", { email, password: nextPassword });
        if (!session.accessToken) throw new Error("The server did not return a valid session.");
        setAccessToken(session.accessToken);
        setUser(normalizeMe(await apiRequest<ApiMe>("/me")));
      },
    }),
    [user, portalId, managerSectionReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
