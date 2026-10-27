import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

// A "branch" in the app is a "location" on the server: Store A, the Warehouse, and so on.
// It is NOT a category. Categories are item types (laptops, doors) shared by every branch.
export type BranchType = "store" | "branch" | "warehouse";

export type BranchRecord = {
  id: number;
  name: string;
  type: BranchType;
  isActive: boolean;
};

export const BRANCH_TYPES: { value: BranchType; label: string }[] = [
  { value: "store", label: "Store" },
  { value: "branch", label: "Branch" },
  { value: "warehouse", label: "Warehouse" },
];

// Every branch query starts with this key, so one invalidate refreshes all of them.
const BRANCHES_KEY = ["locations"] as const;

/** Branches the signed-in person can see. Admins get every branch, others only their own. */
export function useBranches(includeInactive = false) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useQuery({
    queryKey: [...BRANCHES_KEY, { includeInactive }],
    queryFn: async () => {
      const result = await apiRequest<{ items: BranchRecord[] }>(
        `/locations?includeInactive=${includeInactive}`,
      );
      return result.items;
    },
    // Wait until the page is in the browser and someone is signed in. The server render
    // has no access token, so it must not make this call.
    enabled: hydrated && !!user,
    staleTime: 60_000,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: BranchType }) =>
      apiPost<BranchRecord>("/locations", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BRANCHES_KEY }),
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: number;
      name?: string;
      type?: BranchType;
      isActive?: boolean;
    }) =>
      apiRequest<BranchRecord & { usersUnassigned: number }>(`/locations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BRANCHES_KEY }),
  });
}
