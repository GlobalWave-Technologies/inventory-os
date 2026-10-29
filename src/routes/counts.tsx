import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { CountView } from "@/components/CountView";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { useCountStatus, useCounts, useStartCount, type CountState } from "@/lib/counts";
import { errorMessage } from "@/lib/errors";
import { useScopeLocationId } from "@/lib/overview";
import { useMyBranches } from "@/lib/sales";
import { useSingleFlight } from "@/lib/useSingleFlight";

export const Route = createFileRoute("/counts")({
  head: () => ({
    meta: [
      { title: "Stocktaking — StockLine Inventory" },
      { name: "description", content: "Weekly physical stock counts for each branch." },
    ],
  }),
  component: CountsPage,
});

const STATE_TEXT: Record<CountState, string> = {
  not_started: "Not started this week",
  open: "In progress",
  submitted: "Submitted this week",
};

function CountsPage() {
  const scopeId = useScopeLocationId();
  const branches = useMyBranches();
  const status = useCountStatus(scopeId);
  const history = useCounts(scopeId);
  const start = useStartCount();
  const { run, pending } = useSingleFlight();
  const [openId, setOpenId] = useState<number | null>(null);
  const nameOf = (id: number) => branches.find((b) => b.id === id)?.name ?? `Branch ${id}`;
  const past = history.data?.pages.flatMap((page) => page.items) ?? [];

  async function startNow(locationId: number) {
    try {
      const created = await start.mutateAsync(locationId);
      setOpenId(created.id);
    } catch (error) {
      toast.error(errorMessage(error, "Could not start the count."));
    }
  }

  return (
    <AppShell eyebrow="Stock" title="Stocktaking">
      {openId !== null ? (
        <CountView countId={openId} onBack={() => setOpenId(null)} />
      ) : (
        <div className="flex flex-col gap-5">
          {status.isLoading && <LoadingPanels count={2} />}
          {status.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load this week's status.</p>}
          {status.data && (
            <section className="flex flex-col gap-2">
              <p className="text-sm text-fog">
                Week {status.data.weekStart} to {status.data.weekEnd}. Counts are due by {status.data.deadline}.
              </p>
              {status.data.locations.length === 0 && (
                <EmptyState icon={<ClipboardList className="size-6" />} title="No branches" body="You are not assigned to a branch." />
              )}
              {status.data.locations.map((loc) => (
                <div key={loc.locationId} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-strong">{loc.name}</p>
                      <p className={`label-mono mt-0.5 ${loc.overdue ? "text-amber" : ""}`}>
                        {STATE_TEXT[loc.state]}
                        {loc.overdue ? " · overdue" : ""}
                      </p>
                    </div>
                    {loc.state === "open" && loc.openCountId !== null ? (
                      <PrimaryButton onClick={() => setOpenId(loc.openCountId)}>Continue</PrimaryButton>
                    ) : (
                      <PrimaryButton disabled={pending || start.isPending} onClick={() => void run(() => startNow(loc.locationId))}>
                        {loc.state === "submitted" ? "Count again" : "Start count"}
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-base font-semibold text-strong">Past counts</h2>
            {history.isLoading && <LoadingPanels count={2} />}
            {!history.isLoading && past.length === 0 && <p className="text-sm text-fog/70">No counts yet.</p>}
            {past.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className="rounded-2xl border border-hair bg-panel/40 p-3.5 text-left hover:border-aurora-a/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-strong">{nameOf(c.locationId)}</p>
                  <p className="label-mono">{c.status === "open" ? "In progress" : "Submitted"}</p>
                </div>
                <p className="label-mono mt-1">
                  {c.startedByName} · {new Date(c.startedAt).toLocaleDateString()} · {c.lines} counted
                </p>
              </button>
            ))}
            {history.hasNextPage && (
              <GhostButton onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage ? "Loading…" : "Load more"}</GhostButton>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
