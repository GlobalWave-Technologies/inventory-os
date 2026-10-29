import { useInfiniteQuery, useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

export type AdjustmentStatus = "pending" | "approved" | "rejected";

export type Adjustment = {
  id: number;
  locationId: number;
  productId: number;
  /** Signed: positive adds stock, negative removes it. */
  change: number;
  reason: string;
  kind: "correction" | "stock_in";
  status: AdjustmentStatus;
  selfApproved: boolean;
  requestedBy: number | string;
  requestedAt: string;
};

type AdjustmentPage = { items: Adjustment[]; nextCursor: number | null };

const KEY = ["adjustments"] as const;

export function useAdjustments(status: AdjustmentStatus | "all") {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...KEY, status],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<AdjustmentPage>(
        `/adjustments?limit=30&before=${pageParam}${status === "all" ? "" : `&status=${status}`}`,
      ),
    getNextPageParam: (lastPage: AdjustmentPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { locationId: number; productId: number; change: number; reason: string }) =>
      apiPost<Adjustment>("/adjustments", { ...input, kind: "correction" }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: KEY }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export function useDecideAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      apiPost<Adjustment>(`/adjustments/${id}/${action}`, {}),
    // Always refetch, even on failure: a 409 means someone else already decided it.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: KEY }),
        queryClient.invalidateQueries({ queryKey: ["stock"] }),
        queryClient.invalidateQueries({ queryKey: ["movements"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

/** Looks up product names for a list of ids. Each id is fetched once and cached for ten minutes. */
export function useProductNames(ids: number[]) {
  const unique = [...new Set(ids)];
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: ["product-name", id],
      queryFn: () => apiRequest<{ name: string; sku: string }>(`/products/${id}`),
      staleTime: 10 * 60 * 1000,
    })),
  });
  const names = new Map<number, string>();
  unique.forEach((id, index) => {
    const data = results[index]?.data;
    if (data) names.set(id, `${data.name} (${data.sku})`);
  });
  return names;
}
