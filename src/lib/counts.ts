import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

export type CountState = "not_started" | "open" | "submitted";

export type WeeklyStatus = {
  weekStart: string;
  weekEnd: string;
  deadline: string;
  locations: { locationId: number; name: string; state: CountState; openCountId: number | null; overdue: boolean }[];
};

export type CountSummary = {
  id: number;
  locationId: number;
  status: "open" | "submitted";
  startedByName: string;
  startedAt: string;
  submittedAt: string | null;
  lines: number;
};

export type CountLine = {
  productId: number;
  sku: string;
  name: string;
  countedQuantity: number;
  /** Only sent to people who approve adjustments, or once the count is submitted. */
  expectedQuantity?: number;
  difference?: number;
};

export type CountDetail = Omit<CountSummary, "lines"> & {
  lines: CountLine[];
  /** Products with stock here that have not been counted yet. Quantities are never shown. */
  remaining: { productId: number; sku: string; name: string; shelf: string | null }[];
};

type CountPage = { items: CountSummary[]; nextCursor: number | null };

export function useCountStatus(locationId: number | null) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["count-status", locationId],
    queryFn: () => apiRequest<WeeklyStatus>(locationId ? `/counts/status?locationId=${locationId}` : "/counts/status"),
    enabled: hydrated && !!user,
  });
}

export function useCounts(locationId: number | null) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["counts", locationId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<CountPage>(`/counts?limit=20&before=${pageParam}${locationId ? `&locationId=${locationId}` : ""}`),
    getNextPageParam: (lastPage: CountPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

export function useCount(id: number) {
  return useQuery({
    queryKey: ["count", id],
    queryFn: () => apiRequest<CountDetail>(`/counts/${id}`),
  });
}

function useRefreshCounts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["count-status", "counts", "count", "adjustments", "dashboard", "notifications"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useStartCount() {
  const refresh = useRefreshCounts();
  return useMutation({
    mutationFn: (locationId: number) => apiPost<CountSummary>("/counts", { locationId }),
    // A 409 means one is already open: refresh so the page shows it.
    onSettled: refresh,
  });
}

export function useSaveCountLine(countId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: number; countedQuantity: number }) =>
      apiRequest<{ productId: number }>(`/counts/${countId}/lines`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["count", countId] }),
  });
}

export function useSubmitCount(countId: number) {
  const refresh = useRefreshCounts();
  return useMutation({
    mutationFn: () => apiPost<CountSummary & { adjustmentsCreated: number }>(`/counts/${countId}/submit`, {}),
    onSettled: refresh,
  });
}
