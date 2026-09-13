import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, LoaderCircle, LockKeyhole, Send, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { AppShell, PrimaryButton } from "@/components/AppShell";
import { EmptyState, Field, LoadingPanels } from "@/components/Modal";
import { useAccessibleCategories, useAccessibleItems } from "@/lib/ledger";
import { db, listDailySalesReports, submitDailySalesReport, type DailySalesLine } from "@/lib/db";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Daily sales reports — StockLine Inventory" }] }),
  component: ReportsPage,
});

type DraftLine = DailySalesLine;
const today = () => new Date().toISOString().slice(0, 10);

function ReportsPage() {
  const { user, isAdmin } = useAuth();
  const categories = useAccessibleCategories();
  const items = useAccessibleItems();
  const reports = useLiveQuery(() => listDailySalesReports(), []) ?? [];
  const users = useLiveQuery(() => db().users.toArray(), []) ?? [];
  const [reportDate, setReportDate] = useState(today());
  const [categoryId, setCategoryId] = useState("");
  const [draft, setDraft] = useState<Record<string, DraftLine>>({});
  const [submitting, setSubmitting] = useState(false);
  const selectedCategoryId = isAdmin ? categoryId : categories?.[0]?.id ?? "";
  const categoryItems = (items ?? []).filter((item) => item.categoryId === selectedCategoryId);
  const ownReports = reports.filter((report) => report.submittedBy === user?.id);
  const submitted = reports.filter((report) => report.reportDate === reportDate && report.categoryId === selectedCategoryId && report.submittedBy === user?.id).length > 0;

  const totals = useMemo(() => reports.reduce((sum, report) => ({
    units: sum.units + report.totalUnits,
    revenue: sum.revenue + report.revenue,
    profit: sum.profit + report.profit,
  }), { units: 0, revenue: 0, profit: 0 }), [reports]);

  function selectCategory(value: string) {
    setCategoryId(value);
    setDraft({});
  }

  function lineFor(itemId: string, fallback: DraftLine): DraftLine {
    return draft[itemId] ?? fallback;
  }

  async function submit() {
    if (!user || !selectedCategoryId) {
      toast.error("Choose a category first.");
      return;
    }
    const lines = categoryItems.map((item) => lineFor(item.id, { itemId: item.id, itemName: item.name, quantity: 0, originalPrice: item.originalPrice, sellingPrice: item.sellingPrice })).filter((line) => line.quantity > 0);
    if (lines.length === 0) {
      toast.error("Enter at least one sold quantity.");
      return;
    }
    if (!confirm("Submit this daily sales report? It cannot be edited or deleted after submission.")) return;
    setSubmitting(true);
    try {
      await submitDailySalesReport({ reportDate, categoryId: selectedCategoryId, submittedBy: user.id, lines });
      setDraft({});
      toast.success("Daily sales report submitted and locked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The report could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!categories || !items || !user) return <AppShell eyebrow="Reports" title="Daily sales"><LoadingPanels count={3} /></AppShell>;

  return (
    <AppShell eyebrow="Reports" title="Daily sales">
      <div className="flex flex-col gap-5">
        {isAdmin && <AdminSummary totals={totals} reports={reports.length} />}
        {!isAdmin && <ReportForm categories={categories} categoryItems={categoryItems} categoryId={selectedCategoryId} categoryValue={categoryId} onCategoryChange={selectCategory} reportDate={reportDate} onDateChange={setReportDate} draft={draft} setDraft={setDraft} submitted={submitted} submitting={submitting} onSubmit={() => void submit()} />}
        {isAdmin ? <AdminReports reports={reports} categories={categories} users={users} /> : <StaffHistory reports={ownReports} categories={categories} />}
      </div>
    </AppShell>
  );
}

function ReportForm({ categories, categoryItems, categoryId, categoryValue, onCategoryChange, reportDate, onDateChange, draft, setDraft, submitted, submitting, onSubmit }: { categories: { id: string; name: string }[]; categoryItems: { id: string; name: string; originalPrice: number; sellingPrice: number }[]; categoryId: string; categoryValue: string; onCategoryChange: (value: string) => void; reportDate: string; onDateChange: (value: string) => void; draft: Record<string, DraftLine>; setDraft: (value: Record<string, DraftLine>) => void; submitted: boolean; submitting: boolean; onSubmit: () => void }) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-aurora-a/15 text-aurora-a"><ClipboardList className="size-4" /></span><div><p className="label-mono">Staff submission</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Daily sales report</h2><p className="mt-1 text-sm text-fog/75">Enter the prices and quantities sold for one day. Submitted reports are permanent.</p></div></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Report date"><input type="date" className="field" value={reportDate} max={today()} onChange={(event) => onDateChange(event.target.value)} disabled={submitted || submitting} /></Field><Field label="Portal category"><select className="field" value={categoryValue || categoryId} onChange={(event) => onCategoryChange(event.target.value)} disabled={submitted || submitting}><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field></div>
      {submitted ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 p-3 text-sm text-amber"><LockKeyhole className="size-4 shrink-0" /> A report for this category and date has already been submitted and locked.</div> : categoryItems.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-hair p-5 text-center text-sm text-fog/70">No items are available in this category.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-hair"><table className="w-full min-w-[660px] text-left text-sm"><thead className="border-b border-hair text-xs text-fog/60"><tr><th className="px-3 py-3">Item</th><th className="px-3 py-3">Original price</th><th className="px-3 py-3">Sold price</th><th className="px-3 py-3">Sold quantity</th></tr></thead><tbody className="divide-y divide-hair/70">{categoryItems.map((item) => { const line = draft[item.id] ?? { itemId: item.id, itemName: item.name, quantity: 0, originalPrice: item.originalPrice, sellingPrice: item.sellingPrice }; return <tr key={item.id}><td className="px-3 py-3 text-strong">{item.name}</td><td className="px-3 py-3"><input type="number" min={0} step="0.01" className="field min-w-28" value={line.originalPrice} disabled={submitting} onChange={(event) => setDraft({ ...draft, [item.id]: { ...line, originalPrice: Number(event.target.value) || 0 } })} /></td><td className="px-3 py-3"><input type="number" min={0} step="0.01" className="field min-w-28" value={line.sellingPrice} disabled={submitting} onChange={(event) => setDraft({ ...draft, [item.id]: { ...line, sellingPrice: Number(event.target.value) || 0 } })} /></td><td className="px-3 py-3"><input type="number" min={0} step="1" className="field min-w-24" value={line.quantity || ""} disabled={submitting} onChange={(event) => setDraft({ ...draft, [item.id]: { ...line, quantity: Number(event.target.value) || 0 } })} /></td></tr>; })}</tbody></table></div>}
      {!submitted && categoryItems.length > 0 && <PrimaryButton className="mt-4" onClick={onSubmit} disabled={submitting}><span className="flex items-center gap-1.5">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{submitting ? "Submitting report..." : "Review and submit report"}</span></PrimaryButton>}
    </section>
  );
}

function AdminSummary({ totals, reports }: { totals: { units: number; revenue: number; profit: number }; reports: number }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Summary label="Reports submitted" value={reports.toString()} /><Summary label="Units sold" value={totals.units.toString()} /><Summary label="Revenue / profit" value={`${money(totals.revenue)} / ${money(totals.profit)}`} /></div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <section className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">{label}</p><p className="num mt-3 text-xl font-semibold text-strong">{value}</p></section>; }

function AdminReports({ reports, categories, users }: { reports: Awaited<ReturnType<typeof listDailySalesReports>>; categories: { id: string; name: string }[]; users: { id: string; name: string }[] }) {
  return <section className="glass rounded-2xl p-4 sm:p-5"><div className="flex items-center gap-3"><TrendingUp className="size-5 text-aurora-a" /><div><p className="label-mono">Admin analysis</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Submitted daily sales</h2></div></div>{reports.length === 0 ? <p className="mt-4 text-sm text-fog/70">No staff reports submitted yet.</p> : <div className="mt-4 flex flex-col gap-3">{reports.map((report) => <article key={report.id} className="rounded-xl border border-hair bg-panel/40 p-3 sm:p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium text-strong">{categories.find((category) => category.id === report.categoryId)?.name ?? "Unknown category"} · {report.reportDate}</p><p className="label-mono mt-1">Submitted by {users.find((user) => user.id === report.submittedBy)?.name ?? "Unknown staff"} · {report.totalUnits} units</p></div><div className="text-left sm:text-right"><p className="num font-semibold text-aurora-a">{money(report.revenue)}</p><p className="label-mono">Revenue · {money(report.profit)} profit</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{report.lines.map((line) => <p key={line.itemId} className="text-xs text-fog/75">{line.itemName}: {line.quantity} sold · {money(line.sellingPrice)} each</p>)}</div><p className="mt-3 flex items-center gap-1.5 text-xs text-amber"><LockKeyhole className="size-3" /> Locked after submission</p></article>)}</div>}</section>;
}

function StaffHistory({ reports, categories }: { reports: Awaited<ReturnType<typeof listDailySalesReports>>; categories: { id: string; name: string }[] }) {
  return <section className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">History</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Your submitted reports</h2>{reports.length === 0 ? <p className="mt-4 text-sm text-fog/70">No reports submitted yet.</p> : <div className="mt-4 flex flex-col gap-2">{reports.map((report) => <div key={report.id} className="flex flex-col gap-2 rounded-xl border border-hair bg-panel/40 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-strong">{categories.find((category) => category.id === report.categoryId)?.name ?? "Unknown category"} · {report.reportDate}</p><p className="label-mono mt-1">{report.totalUnits} units · locked</p></div><p className="num text-sm text-aurora-a">{money(report.revenue)} revenue</p></div>)}</div>}</section>;
}