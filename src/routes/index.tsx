import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { AlertTriangle, ArrowLeftRight, Boxes, Coins, PackageX, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadingPanels } from "@/components/Modal";
import { TYPE_LABEL } from "@/components/StockModals";
import { useAuth } from "@/lib/auth";
import { cedi, timeAgo } from "@/lib/format";
import { useDashboard, useScopeLocationId } from "@/lib/overview";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StockLine Inventory | Multi-branch Stock & Sales Management" },
      { name: "description", content: "StockLine is an inventory management system for businesses with several branches: track stock, transfers, sales, purchasing and reports in one place." },
    ],
  }),
  component: Dashboard,
});

function Stat({
  label,
  value,
  hint,
  icon,
  tone,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  to: "/items" | "/adjustments" | "/transfers" | "/categories";
}) {
  return (
    <Link to={to}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="glass card3d h-full rounded-2xl p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="label-mono">{label}</p>
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg"
            style={{ backgroundColor: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone }}
          >
            {icon}
          </span>
        </div>
        <p className="num mt-3 text-2xl font-semibold text-strong sm:text-3xl">{value}</p>
        <p className="mt-1 text-xs text-fog/70">{hint}</p>
      </motion.div>
    </Link>
  );
}

function Dashboard() {
  const { user, isAdmin } = useAuth();
  const scopeId = useScopeLocationId();
  const query = useDashboard(scopeId);
  const data = query.data;
  const branchName = isAdmin ? "All branches" : (user?.branches.find((b) => Number(b.id) === scopeId)?.name ?? "");
  const transferWork = data
    ? Number(data.transfers.toApprove) + Number(data.transfers.toDispatch) + Number(data.transfers.toReceive)
    : 0;

  return (
    <AppShell eyebrow={branchName || "Overview"} title="Dashboard">
      {query.isLoading ? (
        <LoadingPanels />
      ) : query.isError || !data ? (
        <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">
          Could not load the dashboard. Check your connection and refresh.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <Stat
              label="Low stock"
              value={String(Number(data.lowStock))}
              hint="At or below the alert level"
              icon={<AlertTriangle className="size-4" />}
              tone="var(--amber)"
              to="/items"
            />
            <Stat
              label="Out of stock"
              value={String(Number(data.outOfStock))}
              hint="Count is zero"
              icon={<PackageX className="size-4" />}
              tone="var(--rose)"
              to="/items"
            />
            <Stat
              label="Adjustments waiting"
              value={String(Number(data.pendingAdjustments))}
              hint="Need a decision"
              icon={<SlidersHorizontal className="size-4" />}
              tone="var(--aurora-c)"
              to="/adjustments"
            />
            <Stat
              label="Transfer work"
              value={String(transferWork)}
              hint={`${Number(data.transfers.toApprove)} to approve · ${Number(data.transfers.toDispatch)} to send · ${Number(data.transfers.toReceive)} to receive`}
              icon={<ArrowLeftRight className="size-4" />}
              tone="var(--aurora-b)"
              to="/transfers"
            />
          </div>

          {(data.stockValue !== undefined || data.totals) && (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {data.stockValue !== undefined && (
                <Stat
                  label="Stock value"
                  value={cedi(data.stockValue)}
                  hint="Units × cost"
                  icon={<Coins className="size-4" />}
                  tone="var(--aurora-a)"
                  to="/items"
                />
              )}
              {data.totals && (
                <Stat
                  label="Products"
                  value={String(Number(data.totals.products))}
                  hint={`${Number(data.totals.locations)} active branches`}
                  icon={<Boxes className="size-4" />}
                  tone="var(--aurora-a)"
                  to="/categories"
                />
              )}
            </div>
          )}

          <section className="glass overflow-hidden rounded-2xl border-aurora-b/20 p-4 sm:p-5">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="label-mono text-aurora-b">Live feed</p>
                <h2 className="mt-1 font-display text-lg font-semibold text-strong">Recent movements</h2>
              </div>
              <Link to="/activity" className="text-xs text-aurora-a">
                Full log
              </Link>
            </div>
            {data.recentMovements.length === 0 ? (
              <p className="rounded-xl border border-dashed border-hair px-4 py-8 text-center text-sm text-fog/70">
                Movements will appear here as stock changes.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {data.recentMovements.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-strong">{m.productName}</p>
                      <p className="label-mono mt-0.5">
                        {TYPE_LABEL[m.type]} · {timeAgo(m.createdAt)}
                        {m.userName ? ` · ${m.userName}` : ""}
                      </p>
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
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
