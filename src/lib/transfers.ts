import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

export type TransferStatus = "pending" | "approved" | "in_transit" | "received" | "rejected" | "cancelled";
export type TransferAction = "approve" | "reject" | "cancel" | "dispatch" | "receive";

export type Transfer = {
  id: number;
  fromLocationId: number;
  toLocationId: number;
  productId: number;
  productName: string;
  quantity: number;
  status: TransferStatus;
  requestedBy: number | string;
  requestedAt: string;
};

type TransferPage = { items: Transfer[]; nextCursor: number | null };

const KEY = ["transfers"] as const;

export function useTransfers(status: TransferStatus | "all") {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...KEY, status],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<TransferPage>(
        `/transfers?limit=30&before=${pageParam}${status === "all" ? "" : `&status=${status}`}`,
      ),
    getNextPageParam: (lastPage: TransferPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

/** Every active branch's id and name. Staff can only see their own branches elsewhere, but a transfer needs a source. */
export function useBranchDirectory() {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["locations", "directory"],
    queryFn: () => apiRequest<{ items: { id: number; name: string }[] }>("/locations/directory"),
    enabled: hydrated && !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fromLocationId: number;
      toLocationId: number;
      productId: number;
      quantity: number;
      reason?: string;
      expectedDate?: string;
    }) => apiPost<Transfer>("/transfers", input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: KEY }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export function useTransferAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: TransferAction }) =>
      apiPost<Transfer>(`/transfers/${id}/${action}`, {}),
    // Refetch even on failure: a 409 means the transfer moved on without you.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: KEY }),
        queryClient.invalidateQueries({ queryKey: ["stock"] }),
        queryClient.invalidateQueries({ queryKey: ["movements"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}
