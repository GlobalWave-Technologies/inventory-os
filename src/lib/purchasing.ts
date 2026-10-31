import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

// ---- Suppliers -------------------------------------------------------------------------------

export type Supplier = { id: number; name: string; contact: string; email: string; notes: string; createdAt: string };
type SupplierPage = { items: Supplier[]; nextCursor: number | null };

export function useSuppliers(enabled: boolean) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["suppliers"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => apiRequest<SupplierPage>(`/suppliers?limit=100&after=${pageParam}`),
    getNextPageParam: (lastPage: SupplierPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && hydrated && !!user,
  });
}

export type SupplierInput = { name: string; contact: string; email: string; notes: string };

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierInput) => apiPost<Supplier>("/suppliers", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] }); // refresh in the background; don't hold the form open
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: SupplierInput & { id: number }) =>
      apiRequest<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] }); // refresh in the background; don't hold the form open
    },
  });
}

// ---- Purchase orders -------------------------------------------------------------------------

export type OrderStatus = "ordered" | "received" | "cancelled";

export type PurchaseOrder = {
  id: number;
  supplierId: number;
  supplierName: string;
  productId: number;
  productName: string;
  locationId: number;
  quantity: number;
  /** Cedis as text. */
  unitCost: string;
  total: string;
  status: OrderStatus;
  createdAt: string;
  receivedAt: string | null;
};
type OrderPage = { items: PurchaseOrder[]; nextCursor: number | null };

export function useOrders(status: OrderStatus | "all", enabled: boolean) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["purchase-orders", status],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<OrderPage>(`/purchase-orders?limit=30&before=${pageParam}${status === "all" ? "" : `&status=${status}`}`),
    getNextPageParam: (lastPage: OrderPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && hydrated && !!user,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { supplierId: number; productId: number; locationId: number; quantity: number; unitCost: string }) =>
      apiPost<PurchaseOrder>("/purchase-orders", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }); // refresh in the background; don't hold the form open
    },
  });
}

export function useOrderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "receive" | "cancel" }) =>
      apiPost<PurchaseOrder>(`/purchase-orders/${id}/${action}`, {}),
    // Refetch even on failure: a 409 means the order already changed.
    onSettled: () =>
      Promise.all(
        ["purchase-orders", "stock", "movements", "dashboard", "product-name", "products"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

// ---- Stock requests --------------------------------------------------------------------------

export type RequestStatus = "pending" | "approved" | "rejected";

export type StockRequest = {
  id: number;
  locationId: number;
  productId: number | null;
  itemName: string;
  quantity: number;
  note: string;
  status: RequestStatus;
  requestedBy: number | string;
  requestedByName: string;
  createdAt: string;
};
type RequestPage = { items: StockRequest[]; nextCursor: number | null };

export function useStockRequests(status: RequestStatus | "all") {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["stock-requests", status],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<RequestPage>(`/stock-requests?limit=30&before=${pageParam}${status === "all" ? "" : `&status=${status}`}`),
    getNextPageParam: (lastPage: RequestPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

export function useCreateStockRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { locationId: number; productId?: number; itemName: string; quantity: number; note?: string }) =>
      apiPost<StockRequest>("/stock-requests", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock-requests"] }); // refresh in the background; don't hold the form open
    },
  });
}

export function useDecideStockRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      apiPost<StockRequest>(`/stock-requests/${id}/${action}`, {}),
    onSettled: () =>
      Promise.all(
        ["stock-requests", "notifications"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      ),
  });
}
