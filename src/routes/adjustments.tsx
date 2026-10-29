import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdjustmentModal } from "@/components/AdjustmentModal";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import {
  useAdjustments,
  useDecideAdjustment,
  useProductNames,
  type Adjustment,
  type AdjustmentStatus,
} from "@/lib/adjustments";
import { useAuth } from "@/lib/auth";
import { useBranches } from "@/lib/branches";
import { errorMessage } from "@/lib/errors";
import { useSingleFlight } from "@/lib/useSingleFlight";

export const Route = createFileRoute("/adjustments")({
  head: () => ({
    meta: [
      { title: "Stock adjustments — StockLine Inventory" },
      { name: "description", content: "Request, approve and reject stock count corrections." },
    ],
  }),
  component: AdjustmentsPage,
});

const FILTERS: { value: AdjustmentStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function AdjustmentsPage() {
  const { user, isAdmin, managerSectionEnabled, portalId } = useAuth();
  const branchesQuery = useBranches(false);
  const [filter, setFilter] = useState<AdjustmentStatus | "all">("pending");
  const [creating, setCreating] = useState(false);
  const decide = useDecideAdjustment();
  const { run, pending } = useSingleFlight();

  const query = useAdjustments(filter);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const productNames = useProductNames(items.map((item) => item.productId));

  const branches = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return (branchesQuery.data ?? []).filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
    return user.branches.map((b) => ({ id: Number(b.id), name: b.name }));
  }, [user, isAdmin, branchesQuery.data]);
  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? `Branch ${id}`;

  // Mirrors the server: admins decide anywhere, managers only at their branches and only while
  // the manager section is on. Nobody decides their own request, except an admin while managers are off.
  function canDecide(item: Adjustment) {
    if (!user || item.status !== "pending") return false;
    const manages = isAdmin || (managerSectionEnabled && user.role === "manager" && user.branchIds.includes(String(item.locationId)));
    if (!manages) return false;
    const own = String(item.requestedBy) === user.id;
    return !own || (isAdmin && !managerSectionEnabled);
  }

  async function decideNow(item: Adjustment, action: "approve" | "reject") {
    try {
      await decide.mutateAsync({ id: item.id, action });
      toast.success(action === "approve" ? "Approved. Stock updated." : "Rejected");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the decision."));
    }
  }

  return (
    <AppShell
      eyebrow="Stock"
      title="Adjustments"
      actions={<PrimaryButton onClick={() => setCreating(true)}>New adjustment</PrimaryButton>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((entry) => (
            <GhostButton
              key={entry.value}
              onClick={() => setFilter(entry.value)}
              className={filter === entry.value ? "!border-aurora-a/50 !text-strong" : ""}
            >
              {entry.label}
            </GhostButton>
          ))}
        </div>

        {query.isLoading && <LoadingPanels count={3} />}
        {query.isError && (
          <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load adjustments.</p>
        )}
        {!query.isLoading && !query.isError && items.length === 0 && (
          <EmptyState
            icon={<SlidersHorizontal className="size-6" />}
            title="Nothing here"
            body={filter === "pending" ? "No adjustments are waiting for a decision." : "No adjustments match this filter."}
          />
        )}

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-strong">
                    {productNames.get(item.productId) ?? `Product ${item.productId}`}
                  </p>
                  <p className="label-mono mt-0.5">
                    {branchName(item.locationId)} · {item.kind === "stock_in" ? "Stock in" : "Correction"}
                  </p>
                </div>
                <p className={`num text-xl font-semibold ${item.change < 0 ? "text-rose" : "text-aurora-a"}`}>
                  {item.change > 0 ? `+${item.change}` : item.change}
                </p>
              </div>
              <p className="mt-2 break-words text-sm text-fog">{item.reason}</p>
              <p className="label-mono mt-1.5">
                {String(item.requestedBy) === user?.id ? "You" : "A team member"} ·{" "}
                {new Date(item.requestedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                {item.status}
                {item.selfApproved ? " · self-approved" : ""}
              </p>
              {canDecide(item) && (
                <div className="mt-3 flex gap-2">
                  <PrimaryButton disabled={pending || decide.isPending} onClick={() => void run(() => decideNow(item, "approve"))}>
                    Approve
                  </PrimaryButton>
                  <GhostButton onClick={() => void run(() => decideNow(item, "reject"))}>Reject</GhostButton>
                </div>
              )}
            </div>
          ))}
        </div>

        {query.hasNextPage && (
          <div className="flex justify-center">
            <GhostButton onClick={() => void query.fetchNextPage()}>
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </GhostButton>
          </div>
        )}
      </div>

      {creating && (
        <AdjustmentModal
          onClose={() => setCreating(false)}
          branches={branches}
          defaultBranchId={portalId ? Number(portalId) : null}
        />
      )}
    </AppShell>
  );
}
