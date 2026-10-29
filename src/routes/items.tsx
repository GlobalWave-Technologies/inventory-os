import { createFileRoute } from "@tanstack/react-router";
import { Package, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import {
  HistoryModal,
  StockActionModal,
  ThresholdModal,
  type StockMode,
} from "@/components/StockModals";
import { useAuth } from "@/lib/auth";
import { useBranches } from "@/lib/branches";
import { useStock, type StockRow } from "@/lib/stock";

export const Route = createFileRoute("/items")({
  head: () => ({
    meta: [
      { title: "Inventory & stock — StockLine Inventory" },
      { name: "description", content: "Live stock counts for each branch." },
    ],
  }),
  component: InventoryPage,
});

type Action =
  | { kind: "stock"; mode: StockMode; row: StockRow | null }
  | { kind: "threshold"; row: StockRow }
  | { kind: "history"; row: StockRow };

function InventoryPage() {
  const { user, isAdmin, managerSectionEnabled, portalId } = useAuth();
  const branchesQuery = useBranches(false);

  const branchOptions = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return (branchesQuery.data ?? []).filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
    return user.branches.map((b) => ({ id: Number(b.id), name: b.name }));
  }, [user, isAdmin, branchesQuery.data]);

  const [chosen, setChosen] = useState<number | null>(null);
  const locationId =
    chosen !== null && branchOptions.some((b) => b.id === chosen)
      ? chosen
      : portalId && branchOptions.some((b) => b.id === Number(portalId))
        ? Number(portalId)
        : (branchOptions[0]?.id ?? null);
  const branchName = branchOptions.find((b) => b.id === locationId)?.name ?? "";

  const stockQuery = useStock(locationId);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  const rows = stockQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const needle = search.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (!lowOnly || row.quantity <= row.minThreshold) &&
      (!needle || row.name.toLowerCase().includes(needle) || row.sku.toLowerCase().includes(needle)),
  );
  const lowCount = rows.filter((row) => row.quantity <= row.minThreshold).length;

  const addsDirectly = isAdmin || (managerSectionEnabled && user?.role === "manager");
  const addMode: StockMode = addsDirectly ? "in" : "request";

  return (
    <AppShell
      eyebrow="Stock"
      title="Inventory"
      actions={
        locationId !== null ? (
          <PrimaryButton onClick={() => setAction({ kind: "stock", mode: addMode, row: null })}>
            {addsDirectly ? "Add stock" : "Request stock"}
          </PrimaryButton>
        ) : undefined
      }
    >
      {locationId === null ? (
        branchesQuery.isLoading ? (
          <LoadingPanels count={3} />
        ) : (
          <EmptyState
            icon={<Package className="size-6" />}
            title="No branch yet"
            body={isAdmin ? "Create a branch in Settings first." : "You are not assigned to a branch."}
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {branchOptions.length > 1 && (
              <select
                className="field max-w-[14rem]"
                value={locationId}
                onChange={(e) => setChosen(Number(e.target.value))}
              >
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog/60" />
              <input
                className="field pl-9"
                placeholder="Search loaded items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <GhostButton onClick={() => setLowOnly((v) => !v)}>
              {lowOnly ? "Showing low only" : `Low stock (${lowCount})`}
            </GhostButton>
          </div>

          {stockQuery.isLoading && <LoadingPanels count={4} />}
          {stockQuery.isError && (
            <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">
              Could not load the stock. Check your connection and try again.
            </p>
          )}
          {!stockQuery.isLoading && !stockQuery.isError && visible.length === 0 && (
            <EmptyState
              icon={<Package className="size-6" />}
              title={rows.length === 0 ? "No stock here yet" : "Nothing matches"}
              body={
                rows.length === 0
                  ? "Use “Add stock” to bring the first products into this branch."
                  : "Try another search."
              }
            />
          )}

          <div className="flex flex-col gap-2">
            {visible.map((row) => {
              const low = row.quantity <= row.minThreshold;
              return (
                <div key={row.productId} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-strong">{row.name}</p>
                      <p className="label-mono mt-0.5">
                        {row.sku}
                        {row.shelf ? ` · ${row.shelf}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`num text-xl font-semibold ${low ? "text-amber" : "text-strong"}`}>
                        {row.quantity}
                      </p>
                      {low && <p className="label-mono text-amber">Low (≤ {row.minThreshold})</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <GhostButton onClick={() => setAction({ kind: "stock", mode: addMode, row })}>
                      {addsDirectly ? "Add" : "Request in"}
                    </GhostButton>
                    <GhostButton onClick={() => setAction({ kind: "stock", mode: "out", row })}>Remove</GhostButton>
                    <GhostButton onClick={() => setAction({ kind: "history", row })}>History</GhostButton>
                    <GhostButton onClick={() => setAction({ kind: "threshold", row })}>Level & shelf</GhostButton>
                  </div>
                </div>
              );
            })}
          </div>

          {stockQuery.hasNextPage && (
            <div className="flex justify-center">
              <GhostButton onClick={() => void stockQuery.fetchNextPage()}>
                {stockQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </GhostButton>
            </div>
          )}
        </div>
      )}

      {action?.kind === "stock" && locationId !== null && (
        <StockActionModal
          onClose={() => setAction(null)}
          locationId={locationId}
          branchName={branchName}
          mode={action.mode}
          product={action.row ? { id: action.row.productId, name: action.row.name, sku: action.row.sku } : null}
        />
      )}
      {action?.kind === "threshold" && locationId !== null && (
        <ThresholdModal onClose={() => setAction(null)} locationId={locationId} branchName={branchName} row={action.row} />
      )}
      {action?.kind === "history" && locationId !== null && (
        <HistoryModal onClose={() => setAction(null)} locationId={locationId} branchName={branchName} row={action.row} />
      )}
    </AppShell>
  );
}
