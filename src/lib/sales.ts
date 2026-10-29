import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useBranches } from "./branches";
import { useHydrated } from "./theme";

/** The branches this person can work in: admins get every active branch, others get the ones they are assigned to. */
export function useMyBranches() {
  const { user, isAdmin } = useAuth();
  const branchesQuery = useBranches(false);
  return useMemo(() => {
    if (!user) return [];
    if (isAdmin) return (branchesQuery.data ?? []).filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
    return user.branches.map((b) => ({ id: Number(b.id), name: b.name }));
  }, [user, isAdmin, branchesQuery.data]);
}

// ---- Daily sales reports ---------------------------------------------------------------------

export type SalesReport = {
  id: number;
  locationId: number;
  reportDate: string;
  type: "individual" | "branch_summary";
  submittedByName: string;
  submittedAt: string;
  totalUnits: number;
  /** Cedis as text. */
  revenue: string;
  /** Only sent to managers and admins. */
  cost?: string;
  profit?: string;
  summaryId: number | null;
};

export type SalesReportDetail = SalesReport & {
  lines: { productId: number; productName: string; quantity: number; revenue: string; listTotal: string; cost?: string }[];
  sourceReportIds: number[];
};

type ReportPage = { items: SalesReport[]; nextCursor: number | null };

export function useSalesReports(locationId: number | null) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["sales-reports", locationId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<ReportPage>(`/sales/reports?limit=30&before=${pageParam}${locationId ? `&locationId=${locationId}` : ""}`),
    getNextPageParam: (lastPage: ReportPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

export function useSalesReport(id: number) {
  return useQuery({
    queryKey: ["sales-report", id],
    queryFn: () => apiRequest<SalesReportDetail>(`/sales/reports/${id}`),
  });
}

function useRefreshAfterSale() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["sales-reports", "returns", "stock", "movements", "dashboard", "profit-loss"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useCreateSalesReport() {
  const refresh = useRefreshAfterSale();
  return useMutation({
    mutationFn: (input: {
      locationId: number;
      reportDate: string;
      lines: { productId: number; quantity: number; sellingPrice?: string }[];
    }) => apiPost<SalesReport>("/sales/reports", input),
    onSuccess: refresh,
  });
}

export function useCreateSummary() {
  const refresh = useRefreshAfterSale();
  return useMutation({
    mutationFn: (input: { locationId: number; reportDate: string }) => apiPost<SalesReport>("/sales/summaries", input),
    onSuccess: refresh,
  });
}

// ---- Returns ---------------------------------------------------------------------------------

export type ReasonCode = "defective" | "wrong-item" | "changed-mind" | "other";
export type Condition = "restock" | "damaged";

export type SaleReturn = {
  id: number;
  locationId: number;
  productId: number;
  productName: string;
  quantity: number;
  reasonCode: ReasonCode;
  condition: Condition;
  reason: string;
  /** Cedis as text. */
  refund: string;
  cost?: string;
  createdByName: string;
  createdAt: string;
};

type ReturnPage = { items: SaleReturn[]; nextCursor: number | null };

export function useReturns(locationId: number | null) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["returns", locationId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<ReturnPage>(`/sales/returns?limit=30&before=${pageParam}${locationId ? `&locationId=${locationId}` : ""}`),
    getNextPageParam: (lastPage: ReturnPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

export function useReturnable(locationId: number | null, productId: number | null) {
  return useQuery({
    queryKey: ["returnable", locationId, productId],
    queryFn: () =>
      apiRequest<{ sold: number; returned: number; eligible: number }>(
        `/sales/returnable?locationId=${locationId}&productId=${productId}`,
      ),
    enabled: locationId !== null && productId !== null,
  });
}

export function useCreateReturn() {
  const refresh = useRefreshAfterSale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      locationId: number;
      productId: number;
      quantity: number;
      reasonCode: ReasonCode;
      condition: Condition;
      reason?: string;
    }) => apiPost<SaleReturn>("/sales/returns", input),
    onSuccess: () => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["returnable"] })]),
  });
}
