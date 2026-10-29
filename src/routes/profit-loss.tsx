import { createFileRoute } from "@tanstack/react-router";
import { ChartNoAxesCombined } from "lucide-react";
import { useState } from "react";
import { AppShell, GhostButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { cedi } from "@/lib/format";
import { useSalesBreakdown, useSlowMovers, useValuation, type SalesGroupBy, type ValueGroupBy } from "@/lib/reports";
import { useMyBranches } from "@/lib/sales";

export const Route = createFileRoute("/profit-loss")({
  head: () => ({
    meta: [
      { title: "Reports — StockLine Inventory" },
      { name: "description", content: "Profit and loss, stock value and slow-moving stock." },
    ],
  }),
  component: ReportsPage,
});

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000));

type Tab = "sales" | "value" | "slow";

function Notice({ children }: { children: string }) {
  return <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">{children}</p>;
}

function ReportsPage() {
  const { isAdmin, managerSectionEnabled, user } = useAuth();
  const allowed = isAdmin || (managerSectionEnabled && user?.role === "manager");
  const branches = useMyBranches();
  const [tab, setTab] = useState<Tab>("sales");
  const [branch, setBranch] = useState<number | null>(null);

  return (
    <AppShell eyebrow="Reports" title="Reports">
      {!allowed ? (
        <EmptyState
          icon={<ChartNoAxesCombined className="size-6" />}
          title="Reports are for managers and admins"
          body="Ask an admin if you need access to these numbers."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["sales", "value", "slow"] as const).map((t) => (
              <GhostButton key={t} onClick={() => setTab(t)} className={tab === t ? "!border-aurora-a/50 !text-strong" : ""}>
                {t === "sales" ? "Profit & loss" : t === "value" ? "Stock value" : "Slow movers"}
              </GhostButton>
            ))}
            <select className="field max-w-[14rem]" value={branch ?? ""} onChange={(e) => setBranch(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{isAdmin ? "All branches" : "All my branches"}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {tab === "sales" && <SalesTab locationId={branch} />}
          {tab === "value" && <ValueTab locationId={branch} />}
          {tab === "slow" && <SlowTab locationId={branch} />}
        </div>
      )}
    </AppShell>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="label-mono">{label}</p>
      <p className={`num mt-2 text-xl font-semibold ${tone ?? "text-strong"}`}>{value}</p>
    </div>
  );
}

// ---- Profit and loss -------------------------------------------------------------------------

const GROUP_LABEL: Record<SalesGroupBy, string> = {
  product: "By product",
  category: "By category",
  branch: "By branch",
  staff: "By staff",
  day: "By day",
};

function SalesTab({ locationId }: { locationId: number | null }) {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(isoDay(new Date()));
  const [groupBy, setGroupBy] = useState<SalesGroupBy>("product");
  const query = useSalesBreakdown({ from, to, locationId, groupBy, enabled: true });
  const data = query.data;
  const badRange = from > to;

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-fog/80">
          From
          <input className="field" type="date" max={to} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-fog/80">
          To
          <input className="field" type="date" max={isoDay(new Date())} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select className="field max-w-[12rem]" value={groupBy} onChange={(e) => setGroupBy(e.target.value as SalesGroupBy)}>
          {(Object.keys(GROUP_LABEL) as SalesGroupBy[]).map((g) => (
            <option key={g} value={g}>
              {GROUP_LABEL[g]}
            </option>
          ))}
        </select>
      </div>
      {badRange && <Notice>The start date must not be after the end date.</Notice>}
      {query.isLoading && !badRange && <LoadingPanels count={3} />}
      {query.isError && <Notice>Could not load the report. The range can be at most one year.</Notice>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure label="Revenue" value={cedi(data.totals.revenue)} />
            <Figure label="Refunds" value={cedi(data.totals.refunds)} />
            <Figure label="Cost" value={cedi(data.totals.cost)} />
            <Figure label="Profit" value={cedi(data.totals.profit)} tone="text-aurora-a" />
          </div>
          <p className="text-xs text-fog/70">
            {data.totals.unitsSold} units sold, {data.totals.unitsReturned} returned. Cost is for the units that stayed sold.
          </p>
          {data.items.length === 0 && (
            <EmptyState icon={<ChartNoAxesCombined className="size-6" />} title="No sales in this range" body="Try a wider date range." />
          )}
          <div className="flex flex-col gap-2">
            {data.items.map((row) => (
              <div key={String(row.key)} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-strong">{row.label}</p>
                  <p className="num shrink-0 text-sm font-semibold text-aurora-a">{cedi(row.profit)}</p>
                </div>
                <p className="label-mono mt-1">
                  {row.unitsSold} sold · revenue {cedi(row.netRevenue)} · cost {cedi(row.cost)}
                  {row.unitsReturned > 0 ? ` · ${row.unitsReturned} returned` : ""}
                </p>
              </div>
            ))}
          </div>
          {data.truncated && <p className="text-xs text-fog/70">Showing the top 200 rows. Narrow the dates or branch to see the rest.</p>}
        </>
      )}
    </>
  );
}

// ---- Stock value -----------------------------------------------------------------------------

function ValueTab({ locationId }: { locationId: number | null }) {
  const [groupBy, setGroupBy] = useState<ValueGroupBy>("category");
  const query = useValuation({ locationId, groupBy, enabled: true });
  const data = query.data;
  return (
    <>
      <select className="field max-w-[12rem]" value={groupBy} onChange={(e) => setGroupBy(e.target.value as ValueGroupBy)}>
        <option value="category">By category</option>
        <option value="branch">By branch</option>
        <option value="product">By product</option>
      </select>
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <Notice>Could not load stock value.</Notice>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure label="Units in stock" value={String(data.totals.units)} />
            <Figure label="Value at cost" value={cedi(data.totals.costValue)} />
            <Figure label="Value at price" value={cedi(data.totals.retailValue)} />
            <Figure label="Potential margin" value={cedi(data.totals.potentialMargin)} tone="text-aurora-a" />
          </div>
          <div className="flex flex-col gap-2">
            {data.items.map((row) => (
              <div key={String(row.key)} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-strong">{row.label}</p>
                  <p className="num shrink-0 text-sm font-semibold text-strong">{cedi(row.costValue)}</p>
                </div>
                <p className="label-mono mt-1">
                  {row.units} units · at price {cedi(row.retailValue)} · margin {cedi(row.potentialMargin)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ---- Slow movers -----------------------------------------------------------------------------

function SlowTab({ locationId }: { locationId: number | null }) {
  const [days, setDays] = useState(30);
  const query = useSlowMovers({ days, locationId, enabled: true });
  const items = query.data?.items ?? [];
  return (
    <>
      <select className="field max-w-[14rem]" value={days} onChange={(e) => setDays(Number(e.target.value))}>
        {[14, 30, 60, 90, 180].map((d) => (
          <option key={d} value={d}>
            Not sold in {d} days
          </option>
        ))}
      </select>
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <Notice>Could not load slow movers.</Notice>}
      {query.data && items.length === 0 && (
        <EmptyState icon={<ChartNoAxesCombined className="size-6" />} title="Nothing is stuck" body="Everything in stock has sold recently." />
      )}
      <div className="flex flex-col gap-2">
        {items.map((row) => (
          <div key={`${row.locationId}-${row.productId}`} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-strong">{row.productName}</p>
                <p className="label-mono mt-0.5">{row.locationName}</p>
              </div>
              <div className="text-right">
                <p className="num text-sm font-semibold text-strong">{row.quantity} units</p>
                <p className="label-mono">{cedi(row.costValue)} tied up</p>
              </div>
            </div>
            <p className="label-mono mt-1">{row.lastSold ? `Last sold ${row.lastSold}` : "Never sold"}</p>
          </div>
        ))}
      </div>
    </>
  );
}
