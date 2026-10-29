import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { TransferModal } from "@/components/TransferModal";
import { useAuth } from "@/lib/auth";
import { useBranches } from "@/lib/branches";
import { errorMessage } from "@/lib/errors";
import {
  useBranchDirectory,
  useTransferAction,
  useTransfers,
  type Transfer,
  type TransferAction,
  type TransferStatus,
} from "@/lib/transfers";
import { useSingleFlight } from "@/lib/useSingleFlight";

export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Transfers — StockLine Inventory" },
      { name: "description", content: "Move stock between branches." },
    ],
  }),
  component: TransfersPage,
});

const FILTERS: { value: TransferStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "in_transit", label: "In transit" },
  { value: "received", label: "Received" },
  { value: "all", label: "All" },
];

const STATUS_LABEL: Record<TransferStatus, string> = {
  pending: "Waiting for the sending branch to approve",
  approved: "Approved, waiting to be sent",
  in_transit: "On the way",
  received: "Received",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const DONE: Record<TransferAction, string> = {
  approve: "Approved",
  reject: "Rejected",
  cancel: "Cancelled",
  dispatch: "Sent. Stock left the sending branch.",
  receive: "Received. Stock added to your branch.",
};

function TransfersPage() {
  const { user, isAdmin, managerSectionEnabled, portalId } = useAuth();
  const branchesQuery = useBranches(false);
  const directory = useBranchDirectory();
  const [filter, setFilter] = useState<TransferStatus | "all">("pending");
  const [creating, setCreating] = useState(false);
  const act = useTransferAction();
  const { run, pending } = useSingleFlight();
  const query = useTransfers(filter);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  const myBranches = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return (branchesQuery.data ?? []).filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
    return user.branches.map((b) => ({ id: Number(b.id), name: b.name }));
  }, [user, isAdmin, branchesQuery.data]);
  const nameOf = (id: number) =>
    directory.data?.items.find((b) => b.id === id)?.name ?? myBranches.find((b) => b.id === id)?.name ?? `Branch ${id}`;

  // Mirrors the server's rules so people only see buttons that will work.
  function actionsFor(t: Transfer): TransferAction[] {
    if (!user) return [];
    const atFrom = isAdmin || user.branchIds.includes(String(t.fromLocationId));
    const atTo = isAdmin || user.branchIds.includes(String(t.toLocationId));
    const managesFrom = isAdmin || (managerSectionEnabled && user.role === "manager" && atFrom);
    const own = String(t.requestedBy) === user.id;
    const list: TransferAction[] = [];
    if (t.status === "pending" && managesFrom) list.push("approve", "reject");
    if (t.status === "approved" && atFrom) list.push("dispatch");
    if (t.status === "in_transit" && atTo) list.push("receive");
    if ((t.status === "pending" || t.status === "approved") && (own || managesFrom)) list.push("cancel");
    return list;
  }

  async function actNow(t: Transfer, action: TransferAction) {
    if ((action === "cancel" || action === "reject") && !confirm(`${action === "cancel" ? "Cancel" : "Reject"} this transfer?`)) return;
    try {
      await act.mutateAsync({ id: t.id, action });
      toast.success(DONE[action]);
    } catch (error) {
      // For example "Insufficient stock at source location" or "Transfer is cancelled, cannot approve".
      toast.error(errorMessage(error, "That did not go through."));
    }
  }

  return (
    <AppShell
      eyebrow="Stock"
      title="Transfers"
      actions={<PrimaryButton onClick={() => setCreating(true)}>Request transfer</PrimaryButton>}
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
        {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load transfers.</p>}
        {!query.isLoading && !query.isError && items.length === 0 && (
          <EmptyState icon={<ArrowLeftRight className="size-6" />} title="No transfers here" body="Nothing matches this filter." />
        )}

        <div className="flex flex-col gap-2">
          {items.map((t) => {
            const actions = actionsFor(t);
            return (
              <div key={t.id} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-strong">{t.productName}</p>
                    <p className="label-mono mt-0.5">
                      {nameOf(t.fromLocationId)} → {nameOf(t.toLocationId)}
                    </p>
                  </div>
                  <p className="num text-xl font-semibold text-strong">{t.quantity}</p>
                </div>
                <p className="mt-2 text-sm text-fog">{STATUS_LABEL[t.status]}</p>
                <p className="label-mono mt-1">
                  {new Date(t.requestedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {actions.map((action) =>
                      action === "cancel" || action === "reject" ? (
                        <GhostButton key={action} onClick={() => void run(() => actNow(t, action))}>
                          {action === "cancel" ? "Cancel" : "Reject"}
                        </GhostButton>
                      ) : (
                        <PrimaryButton key={action} disabled={pending || act.isPending} onClick={() => void run(() => actNow(t, action))}>
                          {action === "approve" ? "Approve" : action === "dispatch" ? "Send now" : "Mark received"}
                        </PrimaryButton>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
        <TransferModal
          onClose={() => setCreating(false)}
          destinations={myBranches}
          defaultDestinationId={portalId ? Number(portalId) : null}
        />
      )}
    </AppShell>
  );
}
