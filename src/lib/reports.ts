import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

export type SalesGroupBy = "product" | "category" | "branch" | "staff" | "day";
export type ValueGroupBy = "category" | "branch" | "product";

// All money fields are cedis as text, for example "750.00". Never do arithmetic on them in the browser.
export type SalesTotals = {
  unitsSold: number;
  unitsReturned: number;
  revenue: string;
  refunds: string;
  netRevenue: string;
  cost: string;
  profit: string;
};

export type SalesRow = SalesTotals & { key: string | number | null; label: string };

export type SalesReportData = {
  from: string;
  to: string;
  groupBy: SalesGroupBy;
  totals: SalesTotals;
  items: SalesRow[];
  truncated: boolean;
};

export function useSalesBreakdown(input: { from: string; to: string; locationId: number | null; groupBy: SalesGroupBy; enabled: boolean }) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  const { from, to, locationId, groupBy, enabled } = input;
  return useQuery({
    queryKey: ["profit-loss", from, to, locationId, groupBy],
    queryFn: () =>
      apiRequest<SalesReportData>(
        `/reports/sales?from=${from}&to=${to}&groupBy=${groupBy}&limit=200${locationId ? `&locationId=${locationId}` : ""}`,
      ),
    enabled: enabled && hydrated && !!user && from <= to,
  });
}

export type ValuationTotals = { units: number; costValue: string; retailValue: string; potentialMargin: string };
export type ValuationData = {
  groupBy: ValueGroupBy;
  totals: ValuationTotals;
  items: (ValuationTotals & { key: string | number | null; label: string })[];
};

export function useValuation(input: { locationId: number | null; groupBy: ValueGroupBy; enabled: boolean }) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  const { locationId, groupBy, enabled } = input;
  return useQuery({
    queryKey: ["valuation", locationId, groupBy],
    queryFn: () =>
      apiRequest<ValuationData>(`/reports/valuation?groupBy=${groupBy}&limit=200${locationId ? `&locationId=${locationId}` : ""}`),
    enabled: enabled && hydrated && !!user,
  });
}

export type SlowMover = {
  locationId: number;
  locationName: string;
  productId: number;
  productName: string;
  quantity: number;
  costValue: string;
  lastSold: string | null;
};

export function useSlowMovers(input: { days: number; locationId: number | null; enabled: boolean }) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  const { days, locationId, enabled } = input;
  return useQuery({
    queryKey: ["slow-movers", days, locationId],
    queryFn: () =>
      apiRequest<{ days: number; items: SlowMover[] }>(
        `/reports/slow-movers?days=${days}&limit=100${locationId ? `&locationId=${locationId}` : ""}`,
      ),
    enabled: enabled && hydrated && !!user,
  });
}
