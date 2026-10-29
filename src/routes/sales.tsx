import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { useState } from "react";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { NewReportModal, NewReturnModal, ReportDetailModal, SummaryModal } from "@/components/SalesModals";
import { useAuth } from "@/lib/auth";
import { cedi } from "@/lib/format";
import { useScopeLocationId } from "@/lib/overview";
import { useMyBranches, useReturns, useSalesReports } from "@/lib/sales";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales & returns — StockLine Inventory" },
      { name: "description", content: "Daily sales reports, branch summaries and returns." },
    ],
  }),
  component: SalesPage,
});

type Modalv = "report" | "summary" | "return" | null;

function SalesPage() {
  const { isAdmin, managerSectionEnabled, user } = useAuth();
  const branches = useMyBranches();
  const scopeId = useScopeLocationId();
  const [tab, setTab] = useState<"reports" | "returns">("reports");
  const [branchChoice, setBranchChoice] = useState<number | null>(null);
  const [modal, setModal] = useState<Modalv>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const locationId = isAdmin ? branchChoice : scopeId;
  const canClose = isAdmin || (managerSectionEnabled && user?.role === "manager");
  const nameOf = (id: number) => branches.find((b) => b.id === id)?.name ?? `Branch ${id}`;

  return (
    <AppShell
      eyebrow="Sales"
      title="Sales & returns"
      actions={
        <div className="flex gap-2">
          {canClose && tab === "reports" && <GhostButton onClick={() => setModal("summary")}>Close the day</GhostButton>}
          <PrimaryButton onClick={() => setModal(tab === "reports" ? "report" : "return")}>
            {tab === "reports" ? "New report" : "Record return"}
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={() => setTab("reports")} className={tab === "reports" ? "!border-aurora-a/50 !text-strong" : ""}>
            Daily reports
          </GhostButton>
          <GhostButton onClick={() => setTab("returns")} className={tab === "returns" ? "!border-aurora-a/50 !text-strong" : ""}>
            Returns
          </GhostButton>
          {isAdmin && (
            <select className="field max-w-[14rem]" value={branchChoice ?? ""} onChange={(e) => setBranchChoice(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {tab === "reports" ? <Reports locationId={locationId} nameOf={nameOf} onOpen={setDetailId} /> : <Returns locationId={locationId} nameOf={nameOf} />}
      </div>

      {modal === "report" && <NewReportModal onClose={() => setModal(null)} branches={branches} defaultBranchId={locationId} />}
      {modal === "summary" && <SummaryModal onClose={() => setModal(null)} branches={branches} defaultBranchId={locationId} />}
      {modal === "return" && <NewReturnModal onClose={() => setModal(null)} branches={branches} defaultBranchId={locationId} />}
      {detailId !== null && <ReportDetailModal onClose={() => setDetailId(null)} reportId={detailId} />}
    </AppShell>
  );
}

function Reports({ locationId, nameOf, onOpen }: { locationId: number | null; nameOf: (id: number) => string; onOpen: (id: number) => void }) {
  const query = useSalesReports(locationId);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load reports.</p>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState icon={<Receipt className="size-6" />} title="No reports yet" body="Submit what was sold today with “New report”." />
      )}
      <div className="flex flex-col gap-2">
        {items.map((r) => (
          <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="rounded-2xl border border-hair bg-panel/40 p-3.5 text-left hover:border-aurora-a/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-strong">
                  {r.reportDate} · {r.type === "branch_summary" ? "Branch summary" : "Report"}
                </p>
                <p className="label-mono mt-0.5">
                  {nameOf(r.locationId)} · {r.submittedByName}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-base font-semibold text-strong">{cedi(r.revenue)}</p>
                <p className="label-mono">{r.totalUnits} units</p>
              </div>
            </div>
            {r.profit !== undefined && <p className="label-mono mt-1.5 text-aurora-a">Profit {cedi(r.profit)}</p>}
          </button>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</GhostButton>
        </div>
      )}
    </>
  );
}

function Returns({ locationId, nameOf }: { locationId: number | null; nameOf: (id: number) => string }) {
  const query = useReturns(locationId);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load returns.</p>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState icon={<Receipt className="size-6" />} title="No returns" body="Returned items will appear here." />
      )}
      <div className="flex flex-col gap-2">
        {items.map((r) => (
          <div key={r.id} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-strong">{r.productName}</p>
                <p className="label-mono mt-0.5">
                  {nameOf(r.locationId)} · {r.reasonCode} · {r.condition === "restock" ? "restocked" : "damaged"}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-base font-semibold text-strong">{r.quantity} units</p>
                <p className="label-mono">Refund {cedi(r.refund)}</p>
              </div>
            </div>
            {r.reason && <p className="mt-1.5 break-words text-xs text-fog/80">{r.reason}</p>}
            <p className="label-mono mt-1.5">
              {r.createdByName} · {new Date(r.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</GhostButton>
        </div>
      )}
    </>
  );
}
