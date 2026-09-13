import { createFileRoute } from "@tanstack/react-router";
import { ChartNoAxesCombined, Coins, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingPanels, EmptyState } from "@/components/Modal";
import { accentVar, useCategories, useItems } from "@/lib/ledger";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profit-loss")({
  head: () => ({ meta: [{ title: "Profit & loss — StockLine Inventory" }] }),
  component: ProfitLossPage,
});

function ProfitLossPage() {
  const { isAdmin } = useAuth();
  const items = useItems();
  const categories = useCategories();

  const report = useMemo(() => {
    const list = items ?? [];
    const groups = (categories ?? []).map((category) => {
      const categoryItems = list.filter((item) => item.categoryId === category.id);
      const original = categoryItems.reduce((sum, item) => sum + item.soldQuantity * item.originalPrice, 0);
      const revenue = categoryItems.reduce((sum, item) => sum + item.soldQuantity * item.sellingPrice, 0);
      return { category, items: categoryItems, original, revenue, profit: revenue - original };
    });
    return {
      groups,
      original: groups.reduce((sum, group) => sum + group.original, 0),
      revenue: groups.reduce((sum, group) => sum + group.revenue, 0),
    };
  }, [items, categories]);

  if (!isAdmin) {
    return (
      <AppShell eyebrow="Access" title="Admin only">
        <section className="glass rounded-2xl p-5 text-sm text-fog/80">
          Profit and loss reporting is available to the administrator only.
        </section>
      </AppShell>
    );
  }

  if (!items || !categories) {
    return <AppShell eyebrow="Finance" title="Profit & loss"><LoadingPanels count={3} /></AppShell>;
  }

  const profit = report.revenue - report.original;

  return (
    <AppShell eyebrow="Finance" title="Profit & loss">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Summary label="Original cost" value={report.original} icon={<Coins className="size-4" />} />
          <Summary label="Total revenue" value={report.revenue} icon={<ChartNoAxesCombined className="size-4" />} />
          <Summary label="Projected profit" value={profit} icon={profit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} tone={profit >= 0 ? "text-aurora-a" : "text-rose"} />
        </div>

        {report.groups.length === 0 ? (
          <EmptyState icon={<ChartNoAxesCombined className="size-6" />} title="No category data yet" body="Add items with original and sold prices to see profit and loss." />
        ) : (
          <div className="flex flex-col gap-4">
            {report.groups.map((group) => (
              <section key={group.category.id} className="glass overflow-hidden rounded-2xl">
                <div className="flex flex-col gap-3 border-b border-hair p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: accentVar(group.category.accent) }} />
                    <div>
                      <h2 className="font-display text-base font-semibold text-strong">{group.category.name}</h2>
                      <p className="label-mono mt-0.5">{group.items.length} item{group.items.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <p className={`num text-lg font-semibold ${group.profit >= 0 ? "text-aurora-a" : "text-rose"}`}>
                    {money(group.profit)} profit · {money(group.revenue)} revenue
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="border-b border-hair text-xs text-fog/60">
                      <tr><th className="px-4 py-3 font-medium sm:px-5">Item</th><th className="px-4 py-3 font-medium">Sold</th><th className="px-4 py-3 font-medium">Original price</th><th className="px-4 py-3 font-medium">Sold price</th><th className="px-4 py-3 font-medium">Revenue</th><th className="px-4 py-3 font-medium sm:px-5">Profit</th></tr>
                    </thead>
                    <tbody className="divide-y divide-hair/70">
                      {group.items.map((item) => {
                        const itemRevenue = item.soldQuantity * item.sellingPrice;
                        const itemProfit = item.soldQuantity * (item.sellingPrice - item.originalPrice);
                        return <tr key={item.id}><td className="px-4 py-3 text-strong sm:px-5">{item.name}</td><td className="num px-4 py-3">{item.soldQuantity}</td><td className="num px-4 py-3">{money(item.originalPrice)}</td><td className="num px-4 py-3">{money(item.sellingPrice)}</td><td className="num px-4 py-3">{money(itemRevenue)}</td><td className={`num px-4 py-3 sm:px-5 ${itemProfit >= 0 ? "text-aurora-a" : "text-rose"}`}>{money(itemProfit)}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
        <p className="text-xs text-fog/60">Revenue and profit use units sold and the prices saved on each item. Totals include every category.</p>
      </div>
    </AppShell>
  );
}

function Summary({ label, value, icon, tone = "text-aurora-a" }: { label: string; value: number; icon: React.ReactNode; tone?: string }) {
  return <section className="glass rounded-2xl p-4 sm:p-5"><div className="flex items-center justify-between"><p className="label-mono">{label}</p><span className={`grid size-8 place-items-center rounded-lg bg-aurora-a/10 ${tone}`}>{icon}</span></div><p className={`num mt-3 text-2xl font-semibold ${tone}`}>{money(value)}</p></section>;
}