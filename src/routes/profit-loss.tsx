import { createFileRoute } from "@tanstack/react-router";
import { ChartNoAxesCombined, Coins, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { LoadingPanels, EmptyState } from "@/components/Modal";
import { accentVar, useAccessibleCategories } from "@/lib/ledger";
import { listDailySalesReports } from "@/lib/db";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CATEGORY_PAGE_SIZE = 5;

type ProfitLossLine = {
  id: string;
  name: string;
  soldQuantity: number;
  originalPrice: number;
  sellingPrice: number;
  cost: number;
  revenue: number;
  profit: number;
};

export const Route = createFileRoute("/profit-loss")({
  head: () => ({ meta: [{ title: "Profit & loss — StockLine Inventory" }] }),
  component: ProfitLossPage,
});

function ProfitLossPage() {
  const { isAdmin, user, portalId } = useAuth();
  const categories = useAccessibleCategories();
  const salesReports = useLiveQuery(() => listDailySalesReports(), []);
  const salesReportsForUser = useMemo(
    () => (salesReports ?? []).filter((salesReport) => salesReport.reportType !== "branch-summary" && (isAdmin || (user?.role === "manager" && salesReport.categoryId === portalId && user.categoryIds.includes(salesReport.categoryId)))),
    [salesReports, isAdmin, user, portalId],
  );
  const [categoryPage, setCategoryPage] = useState(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");

  const report = useMemo(() => {
    const groups = (categories ?? []).map((category) => {
      const itemTotals = new Map<string, ProfitLossLine>();
      for (const salesReport of salesReportsForUser.filter((entry) => entry.categoryId === category.id)) {
        for (const line of salesReport.lines) {
          const total = itemTotals.get(line.itemId) ?? { id: line.itemId, name: line.itemName, soldQuantity: 0, originalPrice: 0, sellingPrice: 0, cost: 0, revenue: 0, profit: 0 };
          total.soldQuantity += line.quantity;
          total.cost += line.quantity * line.originalPrice;
          total.revenue += line.quantity * line.sellingPrice;
          total.originalPrice = total.cost / total.soldQuantity;
          total.sellingPrice = total.revenue / total.soldQuantity;
          total.profit = total.revenue - total.cost;
          itemTotals.set(line.itemId, total);
        }
      }
      const categoryItems = Array.from(itemTotals.values());
      const original = categoryItems.reduce((sum, item) => sum + item.cost, 0);
      const revenue = categoryItems.reduce((sum, item) => sum + item.revenue, 0);
      return { category, items: categoryItems, original, revenue, profit: revenue - original };
    }).filter((group) => group.items.length > 0);
    return { groups };
  }, [categories, salesReportsForUser]);

  if (!isAdmin && user?.role !== "manager") {
    return (
      <AppShell eyebrow="Access" title="Manager access required">
        <section className="glass rounded-2xl p-5 text-sm text-fog/80">
          Profit and loss reporting is available to managers and administrators.
        </section>
      </AppShell>
    );
  }

  if (!categories || !salesReports) {
    return <AppShell eyebrow="Finance" title="Profit & loss"><LoadingPanels count={3} /></AppShell>;
  }

  const scopedGroups = isAdmin && selectedCategoryId !== "all"
    ? report.groups.filter((group) => group.category.id === selectedCategoryId)
    : report.groups;
  const scopeOriginal = scopedGroups.reduce((sum, group) => sum + group.original, 0);
  const scopeRevenue = scopedGroups.reduce((sum, group) => sum + group.revenue, 0);
  const scopeProfit = scopeRevenue - scopeOriginal;
  const pageCount = Math.max(1, Math.ceil(scopedGroups.length / CATEGORY_PAGE_SIZE));
  const visibleGroups = scopedGroups.slice((categoryPage - 1) * CATEGORY_PAGE_SIZE, categoryPage * CATEGORY_PAGE_SIZE);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  return (
    <AppShell eyebrow="Finance" title="Profit & loss">
      <div className="flex flex-col gap-5">
        <div><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="label-mono text-aurora-a">{isAdmin ? selectedCategory ? `${selectedCategory.name} overview` : "General overview" : "Shop overview"}</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Financial performance</h2></div>{isAdmin && <label className="grid gap-1 text-xs text-fog/70">Scope<select className="field min-w-48" value={selectedCategoryId} onChange={(event) => { setSelectedCategoryId(event.target.value); setCategoryPage(1); }}><option value="all">All branches</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Summary label="Original cost" value={scopeOriginal} icon={<Coins className="size-4" />} />
          <Summary label="Total revenue" value={scopeRevenue} icon={<ChartNoAxesCombined className="size-4" />} />
          <Summary label="Sales profit" value={scopeProfit} icon={scopeProfit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} tone={scopeProfit >= 0 ? "text-aurora-a" : "text-rose"} />
        </div></div>

        {scopedGroups.length > 0 && <AnalysisChart data={scopedGroups.map((group) => ({ category: group.category.name, revenue: group.revenue, profit: group.profit }))} />}

        {scopedGroups.length === 0 ? (
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
                        const itemRevenue = item.revenue;
                        const itemProfit = item.profit;
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
        <p className="text-xs text-fog/60">{isAdmin ? selectedCategory ? `Calculated from submitted sales reports for ${selectedCategory.name}.` : "Calculated from submitted individual sales reports across all branches." : "Calculated from staff and manager sales reports for your assigned branch."}</p>
      </div>
    </AppShell>
  );
}

function AnalysisChart({ data }: { data: Array<{ category: string; revenue: number; profit: number }> }) {
  if (data.length === 0) return null;
  const highest = data.reduce((best, current) => current.revenue > best.revenue ? current : best, data[0]!);
  const lowest = data.reduce((worst, current) => current.revenue < worst.revenue ? current : worst, data[0]!);

  return (
    <section className="glass rounded-2xl border-aurora-a/20 p-4 sm:p-5">
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