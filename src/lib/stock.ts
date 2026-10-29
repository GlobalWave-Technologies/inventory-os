import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

export type StockRow = {
  productId: number;
  sku: string;
  name: string;
  quantity: number;
  minThreshold: number;
  shelf: string | null;
};

type StockPage = { items: StockRow[]; nextCursor: number | null };

export type MovementType =
  | "stock_in"
  | "stock_out"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "sale"
  | "return_in"
  | "purchase_in";

export type Movement = {
  id: number;
  locationId: number;
  productId: number;
  change: number;
  type: MovementType;
  reason: string | null;
  userName: string | null;
  createdAt: string;
};

type MovementPage = { items: Movement[]; nextCursor: number | null };

const STOCK_KEY = ["stock"] as const;
const MOVEMENTS_KEY = ["movements"] as const;

export function useStock(locationId: number | null) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...STOCK_KEY, locationId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<StockPage>(`/stock/${locationId}?limit=100&after=${pageParam}`),
    getNextPageParam: (lastPage: StockPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user && locationId !== null,
  });
}

export function useMovements(locationId: number, productId: number) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...MOVEMENTS_KEY, locationId, productId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<MovementPage>(
        `/movements?locationId=${locationId}&productId=${productId}&limit=20&before=${pageParam}`,
      ),
    getNextPageParam: (lastPage: MovementPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

export type StockChange = {
  direction: "in" | "out";
  locationId: number;
  productId: number;
  quantity: number;
  reason?: string;
};

export function useChangeStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ direction, ...body }: StockChange) =>
      apiPost<{ newQuantity: number; movementId: number }>(`/stock/${direction}`, body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: STOCK_KEY }),
        queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export function useRequestStockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { locationId: number; productId: number; quantity: number; reason: string }) =>
      apiPost<{ id: number }>("/adjustments", {
        locationId: input.locationId,
        productId: input.productId,
        change: input.quantity,
        reason: input.reason,
        kind: "stock_in",
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adjustments"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export function useSetThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      locationId: number;
      productId: number;
      minThreshold?: number;
      shelf?: string;
    }) =>
      apiRequest<StockRow>("/stock/threshold", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STOCK_KEY }),
  });
}
