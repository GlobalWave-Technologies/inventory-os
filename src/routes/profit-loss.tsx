import { createFileRoute } from "@tanstack/react-router";
import { ChartNoAxesCombined, Coins, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { LoadingPanels, EmptyState } from "@/components/Modal";
import { accentVar, useCategories, useItems } from "@/lib/ledger";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CATEGORY_PAGE_SIZE = 5;

export const Route = createFileRoute("/profit-loss")({
  head: () => ({ meta: [{ title: "Profit & loss — StockLine Inventory" }] }),
  component: ProfitLossPage,
});

function ProfitLossPage() {
  const { isAdmin } = useAuth();
  const items = useItems();
  const categories = useCategories();
  const [categoryPage, setCategoryPage] = useState(1);

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
      chart: groups.map((group) => ({
        category: group.category.name,
        revenue: group.revenue,
        profit: group.profit,
      })),
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
  const pageCount = Math.max(1, Math.ceil(report.groups.length / CATEGORY_PAGE_SIZE));
  const visibleGroups = report.groups.slice((categoryPage - 1) * CATEGORY_PAGE_SIZE, categoryPage * CATEGORY_PAGE_SIZE);

  return (
    <AppShell eyebrow="Finance" title="Profit & loss">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Summary label="Original cost" value={report.original} icon={<Coins className="size-4" />} />
          <Summary label="Total revenue" value={report.revenue} icon={<ChartNoAxesCombined className="size-4" />} />
          <Summary label="Projected profit" value={profit} icon={profit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} tone={profit >= 0 ? "text-aurora-a" : "text-rose"} />
        </div>

        {report.groups.length > 0 && <AnalysisChart data={report.chart} />}

        {report.groups.length === 0 ? (
          <EmptyState icon={<ChartNoAxesCombined className="size-6" />} title="No category data yet" body="Add items with original and sold prices to see profit and loss." />
        ) : (
          <div className="flex flex-col gap-4">
            {visibleGroups.map((group) => (
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
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-hair pt-3">
                <p className="label-mono">Page {categoryPage} of {pageCount}</p>
                <div className="flex gap-2">
                  <button type="button" aria-label="Previous category page" disabled={categoryPage === 1} onClick={() => setCategoryPage((page) => Math.max(1, page - 1))} className="grid size-9 place-items-center rounded-lg border border-hair text-fog transition-colors hover:text-strong disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                  <button type="button" aria-label="Next category page" disabled={categoryPage === pageCount} onClick={() => setCategoryPage((page) => Math.min(pageCount, page + 1))} className="grid size-9 place-items-center rounded-lg border border-hair text-fog transition-colors hover:text-strong disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button>
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-fog/60">Revenue and profit use units sold and the prices saved on each item. Totals include every category.</p>
      </div>
    </AppShell>
  );
}

function AnalysisChart({ data }: { data: Array<{ category: string; revenue: number; profit: number }> }) {
  const highest = data.reduce((best, current) => current.revenue > best.revenue ? current : best, data[0]);
  const lowest = data.reduce((worst, current) => current.revenue < worst.revenue ? current : worst, data[0]);

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label-mono">Analysis</p>
          <h2 className="mt-1 font-display text-base font-semibold text-strong">Revenue and profit by category</h2>
        </div>
        <p className="text-xs text-fog/70">High: {highest.category} · Low: {lowest.category}</p>
      </div>
      <div className="mt-5 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--hair)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="category" tick={{ fill: "var(--fog)", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "var(--fog)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `GH₵${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`} />
            <Tooltip
              contentStyle={{ background: "var(--panel)", border: "1px solid var(--hair)", borderRadius: 12, color: "var(--strong)" }}
              formatter={(value: number, name: string) => [money(value), name === "revenue" ? "Revenue" : "Profit"]}
            />
            <Line type="monotone" dataKey="revenue" stroke="var(--aurora-a)" strokeWidth={3} dot={{ r: 4, fill: "var(--aurora-a)" }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="profit" stroke="var(--aurora-b)" strokeWidth={3} dot={{ r: 4, fill: "var(--aurora-b)" }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-fog/75">
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-aurora-a" /> Revenue</span>
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-aurora-b" /> Profit</span>
      </div>
    </section>
  );
}

function Summary({ label, value, icon, tone = "text-aurora-a" }: { label: string; value: number; icon: React.ReactNode; tone?: string }) {
  return <section className="glass rounded-2xl p-4 sm:p-5"><div className="flex items-center justify-between"><p className="label-mono">{label}</p><span className={`grid size-8 place-items-center rounded-lg bg-aurora-a/10 ${tone}`}>{icon}</span></div><p className={`num mt-3 text-2xl font-semibold ${tone}`}>{money(value)}</p></section>;
}