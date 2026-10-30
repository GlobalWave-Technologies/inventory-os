import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, GhostButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { TYPE_LABEL } from "@/components/StockModals";
import { useAuth } from "@/lib/auth";
import { useBranches } from "@/lib/branches";
import { timeAgo } from "@/lib/format";
import { useAuditLog, useMovementLog, useScopeLocationId, type AuditFilters } from "@/lib/overview";
import { useTeamUsers } from "@/lib/users";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity log — StockLine Inventory" },
      { name: "description", content: "Every stock movement, with who did it and why." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"stock" | "admin">("stock");

  return (
    <AppShell eyebrow="History" title="Activity log">
      <div className="flex flex-col gap-4">
        {isAdmin && (
          <div className="flex gap-2">
            <GhostButton onClick={() => setTab("stock")} className={tab === "stock" ? "!border-aurora-a/50 !text-strong" : ""}>
              Stock movements
            </GhostButton>
            <GhostButton onClick={() => setTab("admin")} className={tab === "admin" ? "!border-aurora-a/50 !text-strong" : ""}>
              Admin actions
            </GhostButton>
          </div>
        )}
        {tab === "stock" || !isAdmin ? <MovementLog /> : <AuditLog />}
      </div>
    </AppShell>
  );
}

function MovementLog() {
  const { isAdmin } = useAuth();
  const scopeId = useScopeLocationId();
  const branchesQuery = useBranches(false);
  const [branchChoice, setBranchChoice] = useState<number | null>(null);
  const [type, setType] = useState("");
  const locationId = isAdmin ? branchChoice : scopeId;
  const query = useMovementLog(locationId, type);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {isAdmin && (
          <select
            className="field max-w-[14rem]"
            value={branchChoice ?? ""}
            onChange={(e) => setBranchChoice(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All branches</option>
            {(branchesQuery.data ?? [])
              .filter((b) => b.isActive)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        )}
        <select className="field max-w-[14rem]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load the log.</p>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState icon={<History className="size-6" />} title="Nothing recorded" body="No movements match these filters." />
      )}

      <ol className="glass flex flex-col rounded-2xl p-2 sm:p-3">
        {items.map((m) => (
          <li key={m.id} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-panel/50">
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-strong">
                {m.productName} <span className="label-mono ml-1">{m.sku}</span>
              </p>
              <p className="label-mono mt-1">
                {TYPE_LABEL[m.type]} · {timeAgo(m.createdAt)} · {m.userName ?? "System"}
              </p>
              {m.reason && <p className="mt-1 break-words text-xs text-fog/80">{m.reason}</p>}
            </div>
            <span
              className={`num shrink-0 rounded-lg px-2 py-1 text-xs ${
                m.change > 0 ? "bg-aurora-a/15 text-aurora-a" : "bg-rose/15 text-rose"
              }`}
            >
              {m.change > 0 ? `+${m.change}` : m.change}
            </span>
          </li>
        ))}
      </ol>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </GhostButton>
        </div>
      )}
    </>
  );
}

const NO_FILTERS: AuditFilters = { userId: null, action: "", from: "", to: "" };

const ACTION_GROUPS: { value: string; label: string }[] = [
  { value: "", label: "All actions" },
  { value: "auth.login_failed", label: "Failed sign-ins" },
  { value: "auth.", label: "Sign-ins & passwords" },
  { value: "user.", label: "Users" },
  { value: "stock.", label: "Stock in / out / limits" },
  { value: "adjustment.", label: "Adjustments" },
  { value: "transfer.", label: "Transfers" },
  { value: "count.", label: "Stocktaking" },
  { value: "stock_request.", label: "Stock requests" },
  { value: "purchase_order.", label: "Purchase orders" },
  { value: "sales.", label: "Sales & returns" },
  { value: "product.", label: "Products" },
  { value: "category.", label: "Categories" },
  { value: "supplier.", label: "Suppliers" },
  { value: "location.", label: "Branches" },
  { value: "settings.", label: "Settings" },
];

/** "purchase_order.received" becomes "Purchase order: received". */
function actionLabel(action: string): string {
  const [group = "", ...rest] = action.split(".");
  const name = group.replace(/_/g, " ");
  const what = rest.join(" ").replace(/_/g, " ");
  const head = name.charAt(0).toUpperCase() + name.slice(1);
  return what ? `${head}: ${what}` : head;
}

function formatDetail(detail: unknown): string {
  if (detail === null || typeof detail !== "object") return "";
  return Object.entries(detail as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

function AuditLog() {
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
  const query = useAuditLog(true, filters);
  const team = useTeamUsers();
  const people = team.data?.pages.flatMap((page) => page.items) ?? [];
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = filters.userId !== null || filters.action !== "" || filters.from !== "" || filters.to !== "";
  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="label-mono">Person</span>
          <select
            className="field max-w-[14rem]"
            value={filters.userId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setFilters((current) => ({ ...current, userId: value ? Number(value) : null }));
            }}
          >
            <option value="">Everyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} ({person.role.replace("_", " ")})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-mono">Action</span>
          <select
            className="field max-w-[14rem]"
            value={filters.action}
            onChange={(event) => {
              const value = event.target.value;
              setFilters((current) => ({ ...current, action: value }));
            }}
          >
            {ACTION_GROUPS.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-mono">From</span>
          <input
            type="date"
            className="field"
            value={filters.from}
            onChange={(event) => {
              const value = event.target.value;
              setFilters((current) => ({ ...current, from: value }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-mono">To</span>
          <input
            type="date"
            className="field"
            value={filters.to}
            onChange={(event) => {
              const value = event.target.value;
              setFilters((current) => ({ ...current, to: value }));
            }}
          />
        </label>
        {filtered && <GhostButton onClick={() => setFilters(NO_FILTERS)}>Clear filters</GhostButton>}
      </div>
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load admin actions.</p>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState
          icon={<History className="size-6" />}
          title={filtered ? "Nothing matches" : "Nothing recorded"}
          body={filtered ? "Try a different person, action or dates." : "Admin actions will appear here."}
        />
      )}
      <ol className="glass flex flex-col rounded-2xl p-2 sm:p-3">
        {items.map((event) => (
          <li key={event.id} className="rounded-xl px-3 py-3 hover:bg-panel/50">
            <p className="text-sm text-strong">{actionLabel(event.action)}</p>
            <p className="label-mono mt-1">
              {timeAgo(event.createdAt)} · {event.userName ?? "System"}
            </p>
            {formatDetail(event.detail) !== "" && (
              <p className="mt-1 break-all text-xs text-fog/70">{formatDetail(event.detail)}</p>
            )}
          </li>
        ))}
      </ol>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </GhostButton>
        </div>
      )}
    </>
  );
}
