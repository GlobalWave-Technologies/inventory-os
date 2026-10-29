import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { AppShell, GhostButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type AppNotification,
} from "@/lib/overview";
import { useSingleFlight } from "@/lib/useSingleFlight";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — StockLine Inventory" },
      { name: "description", content: "Alerts about stock, transfers and adjustments." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const navigate = useNavigate();
  const query = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const { run, pending } = useSingleFlight();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const unread = items.filter((n) => !n.readAt).length;

  async function open(n: AppNotification) {
    try {
      if (!n.readAt) await markOne.mutateAsync(n.id);
    } catch {
      // Opening the page matters more than marking it read.
    }
    if (n.linkType === "transfer") void navigate({ to: "/transfers" });
    else if (n.linkType === "adjustment") void navigate({ to: "/adjustments" });
    else if (n.linkType === "product") void navigate({ to: "/items" });
    else if (n.linkType === "stock_request") void navigate({ to: "/purchasing" });
    else if (n.linkType === "count") void navigate({ to: "/counts" });
  }

  async function readAllNow() {
    try {
      await markAll.mutateAsync();
      toast.success("All marked as read");
    } catch (error) {
      toast.error(errorMessage(error, "Could not update notifications."));
    }
  }

  return (
    <AppShell
      eyebrow="Alerts"
      title="Notifications"
      actions={
        unread > 0 ? (
          <GhostButton onClick={() => void run(readAllNow)}>{pending ? "Working…" : "Mark all read"}</GhostButton>
        ) : undefined
      }
    >
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load notifications.</p>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState icon={<Bell className="size-6" />} title="No notifications" body="You are all caught up." />
      )}
      <div className="flex flex-col gap-2">
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => void open(n)}
            className={`rounded-2xl border p-3.5 text-left ${n.readAt ? "border-hair bg-panel/30" : "border-aurora-a/40 bg-panel/60"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-strong">{n.title}</p>
              {!n.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-aurora-a" />}
            </div>
            {n.body && <p className="mt-1 break-words text-sm text-fog">{n.body}</p>}
            <p className="label-mono mt-1.5">{timeAgo(n.createdAt)}</p>
          </button>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <GhostButton onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </GhostButton>
        </div>
      )}
    </AppShell>
  );
}
