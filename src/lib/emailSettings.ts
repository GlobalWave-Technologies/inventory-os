import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

const MINE_KEY = ["email-pref"] as const;
const KINDS_KEY = ["email-kinds"] as const;

export function useMyEmailPref() {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: () => apiRequest<{ notifyEmail: boolean }>("/me"),
    enabled: hydrated && !!user,
  });
}

export function useSetMyEmailPref() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: boolean) =>
      apiRequest<{ email: boolean }>("/me/notifications", { method: "PATCH", body: JSON.stringify({ email }) }),
    onSuccess: (data) => {
      queryClient.setQueryData(MINE_KEY, { notifyEmail: data.email });
    },
  });
}

export function useEmailKinds() {
  const hydrated = useHydrated();
  const { user, isAdmin } = useAuth();
  return useQuery({
    queryKey: KINDS_KEY,
    queryFn: () => apiRequest<{ emailKinds: string[] }>("/settings"),
    enabled: hydrated && !!user && isAdmin,
  });
}

export function useSetEmailKinds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emailKinds: string[]) =>
      apiRequest<{ emailKinds: string[] }>("/settings", { method: "PATCH", body: JSON.stringify({ emailKinds }) }),
    onSuccess: (data) => {
      queryClient.setQueryData(KINDS_KEY, { emailKinds: data.emailKinds });
    },
  });
}
