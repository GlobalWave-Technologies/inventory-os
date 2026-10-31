import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

// The server has four roles. The screens elsewhere only know three, so this list is separate.
export type RoleName = "super_admin" | "admin" | "manager" | "staff";

export type TeamUser = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: RoleName;
  isActive: boolean;
  /** True until the person has chosen a password from their activation link. */
  pending: boolean;
  createdAt: string;
  locationIds: number[];
};

type UsersPage = { items: TeamUser[]; nextCursor: number | null };

const USERS_KEY = ["users"] as const;

/** Everyone on the team. Admins only; the server refuses anyone else. */
export function useTeamUsers() {
  const hydrated = useHydrated();
  const { user, isAdmin } = useAuth();
  return useInfiniteQuery({
    queryKey: USERS_KEY,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => apiRequest<UsersPage>(`/users?limit=100&after=${pageParam}`),
    getNextPageParam: (lastPage: UsersPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user && isAdmin,
  });
}

/** What the server says about a link it just made. With email switched off, the token comes back. */
export type LinkResult = {
  emailSent: boolean;
  activationToken?: string;
  resetToken?: string;
  expiresInHours?: number;
  expiresInMinutes?: number;
};

export type NewUserInput = {
  email: string;
  name: string;
  phone?: string;
  role: "admin" | "manager" | "staff";
  locationIds: number[];
};

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewUserInput) =>
      apiPost<LinkResult & { user: { id: number; email: string; name: string } }>("/users", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY }); // refresh in the background; don't hold the form open
    },
  });
}

export type UserPatch = {
  id: number;
  name?: string;
  phone?: string;
  role?: "admin" | "manager" | "staff";
  /** Replaces the whole list of assigned branches. */
  locationIds?: number[];
};

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UserPatch) =>
      apiRequest<TeamUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY }); // refresh in the background; don't hold the form open
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiRequest<{ id: number; active: boolean }>(`/users/${id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY }); // refresh in the background; don't hold the form open
    },
  });
}

/** A new activation link for someone who has not set a password yet (valid 48 hours). */
export const requestActivationLink = (id: number) =>
  apiPost<LinkResult>(`/users/${id}/activation-link`, {});

/** A password reset link for someone who is already active (valid 1 hour). */
export const requestResetLink = (id: number) => apiPost<LinkResult>(`/users/${id}/reset-link`, {});
