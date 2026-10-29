import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";
import type { Movement } from "./stock";

/** Which branch the dashboard and logs are about. Admins see every branch (null); others see the one they opened. */
export function useScopeLocationId(): number | null {
  const { isAdmin, portalId } = useAuth();
  return isAdmin ? null : portalId ? Number(portalId) : null;
}

export type DashboardMovement = Movement & { sku: string; productName: string };

export type DashboardData = {
  generatedAt: string;
  // Counts arrive as text from the database, so always wrap them in Number().
  lowStock: number | string;
  outOfStock: number | string;
  transfers: { toApprove: number | string; toDispatch: number | string; toReceive: number | string };
  pendingAdjustments: number | string;
  recentMovements: DashboardMovement[];
  /** Cedis as text. Only sent to managers and admins. */
  stockValue?: string;
  totals?: { products: number | string; locations: number | string };
};

export function useDashboard(locationId: number | null) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dashboard", locationId],
    queryFn: () => apiRequest<DashboardData>(locationId ? `/dashboard?locationId=${locationId}` : "/dashboard"),
    enabled: hydrated && !!user,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

// ---- Stock movement log ----------------------------------------------------------------------

export type LogMovement = DashboardMovement;
type MovementLogPage = { items: LogMovement[]; nextCursor: number | null };

export function useMovementLog(locationId: number | null, type: string) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["movement-log", locationId, type],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<MovementLogPage>(
        `/movements?limit=30&before=${pageParam}${locationId ? `&locationId=${locationId}` : ""}${type ? `&type=${type}` : ""}`,
      ),
    getNextPageParam: (lastPage: MovementLogPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

// ---- Admin audit log -------------------------------------------------------------------------

export type AuditEvent = {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  detail: unknown;
  createdAt: string;
};
type AuditPage = { items: AuditEvent[]; nextCursor: number | null };

export function useAuditLog(enabled: boolean) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["audit"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => apiRequest<AuditPage>(`/audit?limit=30&before=${pageParam}`),
    getNextPageParam: (lastPage: AuditPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && hydrated && !!user,
  });
}

// ---- Notifications ---------------------------------------------------------------------------

export type AppNotification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  linkType: string | null;
  linkId: number | null;
  locationId: number | null;
  createdAt: string;
  readAt: string | null;
};
type NotificationPage = { items: AppNotification[]; nextCursor: number | null };

export function useUnreadCount() {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiRequest<{ count: number }>("/notifications/unread-count"),
    enabled: hydrated && !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useNotifications() {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["notifications", "list"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => apiRequest<NotificationPage>(`/notifications?limit=30&before=${pageParam}`),
    getNextPageParam: (lastPage: NotificationPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiPost<{ id: number }>(`/notifications/${id}/read`, {}),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ updated: number }>("/notifications/read-all", {}),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
