import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, apiPost, apiRequest, clearTokens, hasRefreshToken, saveTokens } from "./api";
import type { User } from "./db";

const SESSION_KEY = "stockline-session";

export type Branch = { id: string; name: string };
export type SessionUser = User & {
  branches: Branch[];
  branchIds: string[];
  managersEnabled: boolean;
};

type ApiMe = Partial<SessionUser> & {
  accessToken?: string;
  refreshToken?: string;
  user?: Partial<SessionUser>;
};

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

function normalizeMe(payload: ApiMe): SessionUser {
  const source = payload.user ?? payload;
  const branches = source.branches ?? [];
  const branchIds = source.branchIds ?? branches.map((branch) => branch.id);
  return {
    ...source,
    id: source.id ?? "",
    name: source.name ?? "",
    email: source.email ?? "",
    role: source.role ?? "staff",
    categoryIds: [],
    createdAt: source.createdAt ?? "",
    branches,
    branchIds,
    managersEnabled: source.managersEnabled ?? false,
  } as SessionUser;
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
    if (!hasRefreshToken()) {
      setUser(null);
      setManagerSectionReady(true);
      return;
    }

    void apiRequest<ApiMe>("/me")
      .then((result) => {
        const nextUser = normalizeMe(result);
        setUser(nextUser);
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
        const tokens = await apiPost<ApiMe>("/auth/login", { email, password });
        if (!tokens.accessToken || !tokens.refreshToken)
          throw new Error("The server did not return a valid session.");
        saveTokens(tokens.accessToken, tokens.refreshToken);
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
        const refreshToken = sessionStorage.getItem("stockline-refresh-token");
        if (refreshToken) void apiPost("/auth/logout", { refreshToken }).catch(() => undefined);
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
        await apiPost("/auth/login", { email, password: nextPassword }).then((tokens) => {
          const session = tokens as ApiMe;
          if (!session.accessToken || !session.refreshToken)
            throw new Error("The server did not return a valid session.");
          saveTokens(session.accessToken, session.refreshToken);
        });
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
