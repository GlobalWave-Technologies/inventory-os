import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, LoaderCircle, LockKeyhole, Send, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { AppShell, PrimaryButton } from "@/components/AppShell";
import { EmptyState, Field, LoadingPanels } from "@/components/Modal";
import { useAccessibleCategories, useAccessibleItems } from "@/lib/ledger";
import { db, listDailySalesReports, submitBranchSalesSummary, submitDailySalesReport, type DailySalesLine, type DailySalesReport, type User } from "@/lib/db";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Daily sales reports — StockLine Inventory" }] }),
  component: ReportsPage,
});

type DraftLine = DailySalesLine;
const today = () => new Date().toISOString().slice(0, 10);
const formatSubmittedAt = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function ReportsPage() {
  const { user, isAdmin, portalId } = useAuth();
  const categories = useAccessibleCategories();
  const items = useAccessibleItems();
  const reports = useLiveQuery(() => listDailySalesReports(), []) ?? [];
  const users = useLiveQuery(() => db().users.toArray(), []) ?? [];
  const [reportDate, setReportDate] = useState(today());
  const [summaryDate, setSummaryDate] = useState(today());
  const [categoryId, setCategoryId] = useState("");
  const [draft, setDraft] = useState<Record<string, DraftLine>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittingSummary, setSubmittingSummary] = useState(false);
  const selectedCategoryId = isAdmin ? categoryId : categories?.[0]?.id ?? "";
  const categoryItems = (items ?? []).filter((item) => item.categoryId === selectedCategoryId);
  const individualReports = reports.filter((report) => report.reportType !== "branch-summary");
  const ownReports = individualReports.filter((report) => report.submittedBy === user?.id);
  const teamReports = individualReports.filter((report) => report.categoryId === portalId && user?.categoryIds.includes(report.categoryId));
  const branchSubmissions = reports.filter((report) => report.reportType === "branch-summary" && report.categoryId === portalId && user?.categoryIds.includes(report.categoryId));
  const branchSubmissionKeys = new Set(reports.filter((report) => report.reportType === "branch-summary").map((report) => `${report.categoryId}:${report.reportDate}`));
  const adminTotalsReports = reports.filter((report) => report.reportType === "branch-summary" || !branchSubmissionKeys.has(`${report.categoryId}:${report.reportDate}`));
  const submitted = reports.some((report) => report.reportDate === reportDate && report.categoryId === selectedCategoryId && (report.submittedBy === user?.id || report.reportType === "branch-summary"));

  const summarySourceReports = teamReports.filter((report) => report.reportDate === summaryDate);
  const summaryAlreadySubmitted = branchSubmissions.some((report) => report.reportDate === summaryDate);
  const visibleReports = isAdmin ? adminTotalsReports : user?.role === "manager" ? teamReports : ownReports;
  const totals = useMemo(() => visibleReports.reduce((sum, report) => ({
    units: sum.units + report.totalUnits,
    revenue: sum.revenue + report.revenue,
    profit: sum.profit + report.profit,
  }), { units: 0, revenue: 0, profit: 0 }), [visibleReports]);

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

  async function submitSummary() {
    if (!user || user.role !== "manager" || !portalId) return;
    if (summarySourceReports.length === 0) {
      toast.error("There are no branch reports to submit for that date.");
      return;
    }
    if (summaryAlreadySubmitted) {
      toast.error("This branch report has already been submitted. Contact an administrator about corrections.");
      return;
    }
    if (!confirm("Submit this locked branch summary to the administrator? It cannot be edited.")) return;
    setSubmittingSummary(true);
    try {
      await submitBranchSalesSummary({ reportDate: summaryDate, categoryId: portalId, submittedBy: user.id });
      toast.success("Branch summary submitted to the administrator and locked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The branch summary could not be submitted.");
    } finally {
      setSubmittingSummary(false);
    }
  }

  if (!categories || !items || !user) return <AppShell eyebrow="Reports" title="Daily sales"><LoadingPanels count={3} /></AppShell>;

  return (
    <AppShell eyebrow="Reports" title="Daily sales">
      <div className="flex flex-col gap-5">
        {isAdmin && <AdminSummary totals={totals} reports={adminTotalsReports.length} />}
        {!isAdmin && <ReportForm categories={categories} categoryItems={categoryItems} categoryId={selectedCategoryId} categoryValue={categoryId} onCategoryChange={selectCategory} reportDate={reportDate} onDateChange={setReportDate} draft={draft} setDraft={setDraft} submitted={submitted} submitting={submitting} onSubmit={() => void submit()} />}
        {isAdmin ? <AdminReports reports={reports} categories={categories} users={users} /> : user.role === "manager" ? <><ManagerSubmissionPanel reportDate={summaryDate} onDateChange={setSummaryDate} reports={summarySourceReports} submission={branchSubmissions.find((report) => report.reportDate === summaryDate)} categories={categories} users={users} submitting={submittingSummary} onSubmit={() => void submitSummary()} /><ManagerSalesHistory reports={teamReports} categories={categories} users={users} /><ManagerSubmissionHistory reports={branchSubmissions} categories={categories} /></> : <StaffHistory reports={ownReports} categories={categories} />}
      </div>
    </AppShell>
  );
}

function ReportForm({ categories, categoryItems, categoryId, categoryValue, onCategoryChange, reportDate, onDateChange, draft, setDraft, submitted, submitting, onSubmit }: { categories: { id: string; name: string }[]; categoryItems: { id: string; name: string; quantity: number; originalPrice: number; sellingPrice: number }[]; categoryId: string; categoryValue: string; onCategoryChange: (value: string) => void; reportDate: string; onDateChange: (value: string) => void; draft: Record<string, DraftLine>; setDraft: (value: Record<string, DraftLine>) => void; submitted: boolean; submitting: boolean; onSubmit: () => void }) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-aurora-a/15 text-aurora-a"><ClipboardList className="size-4" /></span><div><p className="label-mono">Staff submission</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Daily sales report</h2><p className="mt-1 text-sm text-fog/75">Enter units sold from available stock. Submitting updates inventory and locks the report.</p></div></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Report date"><input type="date" className="field" value={reportDate} max={today()} onChange={(event) => onDateChange(event.target.value)} disabled={submitted || submitting} /></Field><Field label="Portal category"><select className="field" value={categoryValue || categoryId} onChange={(event) => onCategoryChange(event.target.value)} disabled={submitted || submitting}><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field></div>
      {submitted ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 p-3 text-sm text-amber"><LockKeyhole className="size-4 shrink-0" /> This report date is already submitted and locked. Contact your manager or administrator about corrections.</div> : categoryItems.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-hair p-5 text-center text-sm text-fog/70">No items are available in this category.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-hair"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-hair text-xs text-fog/60"><tr><th className="px-3 py-3">Item</th><th className="px-3 py-3">Available</th><th className="px-3 py-3">Original price</th><th className="px-3 py-3">Sold price</th><th className="px-3 py-3">Sold quantity</th></tr></thead><tbody className="divide-y divide-hair/70">{categoryItems.map((item) => { const line = draft[item.id] ?? { itemId: item.id, itemName: item.name, quantity: 0, originalPrice: item.originalPrice, sellingPrice: item.sellingPrice }; return <tr key={item.id}><td className="px-3 py-3 text-strong">{item.name}</td><td className="num px-3 py-3">{item.quantity}</td><td className="px-3 py-3"><input type="number" min={0} step="0.01" className="field min-w-28" value={line.originalPrice} disabled={submitting} onChange={(event) => setDraft({ ...draft, [item.id]: { ...line, originalPrice: Number(event.target.value) || 0 } })} /></td><td className="px-3 py-3"><input type="number" min={0} step="0.01" className="field min-w-28" value={line.sellingPrice} disabled={submitting} onChange={(event) => setDraft({ ...draft, [item.id]: { ...line, sellingPrice: Number(event.target.value) || 0 } })} /></td><td className="px-3 py-3"><input type="number" min={0} max={item.quantity} step="1" className="field min-w-24" value={line.quantity || ""} disabled={submitting} onChange={(event) => setDraft({ ...draft, [item.id]: { ...line, quantity: Number(event.target.value) || 0 } })} /></td></tr>; })}</tbody></table></div>}
      {!submitted && categoryItems.length > 0 && <><p className="mt-3 text-xs text-fog/60">Submitting records each sale against inventory and reduces available stock. Reports are locked after submission.</p><PrimaryButton className="mt-4" onClick={onSubmit} disabled={submitting}><span className="flex items-center gap-1.5">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{submitting ? "Submitting report..." : "Review and submit report"}</span></PrimaryButton></>}
    </section>
  );
}

function ManagerSubmissionPanel({ reportDate, onDateChange, reports, submission, categories, users, submitting, onSubmit }: { reportDate: string; onDateChange: (value: string) => void; reports: DailySalesReport[]; submission: DailySalesReport | undefined; categories: { id: string; name: string }[]; users: User[]; submitting: boolean; onSubmit: () => void }) {
  const totalUnits = reports.reduce((sum, report) => sum + report.totalUnits, 0);
  const revenue = reports.reduce((sum, report) => sum + report.revenue, 0);
  const profit = reports.reduce((sum, report) => sum + report.profit, 0);

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <p className="label-mono text-aurora-a">Manager submission to admin</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-strong">Submit branch sales summary</h2>
      <p className="mt-1 text-sm text-fog/75">This locks a summary of staff and manager reports for the selected date. Contact an administrator for corrections.</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Field label="Report date"><input className="field sm:max-w-56" type="date" value={reportDate} max={today()} onChange={(event) => onDateChange(event.target.value)} disabled={submitting} /></Field>
        <div className="grid grid-cols-3 gap-3 sm:min-w-[24rem]">
          <Summary label="Reports" value={String(reports.length)} />
          <Summary label="Units" value={String(totalUnits)} />
          <Summary label="Revenue" value={money(revenue)} />
        </div>
      </div>
      {submission ? (
        <p className="mt-4 rounded-xl border border-aurora-a/30 bg-aurora-a/10 p-3 text-sm text-aurora-a">
          Submitted to admin by {users.find((user) => user.id === submission.submittedBy)?.name ?? "manager"} on {formatSubmittedAt(submission.submittedAt)}. This report is locked.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fog/70">{reports.length ? `${totalUnits} units · ${money(revenue)} revenue · ${money(profit)} profit` : "No team reports have been submitted for this date."}</p>
          <PrimaryButton onClick={onSubmit} disabled={submitting || reports.length === 0}>{submitting ? "Submitting..." : "Submit to admin"}</PrimaryButton>
        </div>
      )}
      {submission && <p className="label-mono mt-2">Branch: {categories.find((category) => category.id === submission.categoryId)?.name ?? "Assigned branch"} · {submission.sourceReportIds?.length ?? 0} reports combined</p>}
    </section>
  );
}

function ManagerSubmissionHistory({ reports, categories }: { reports: DailySalesReport[]; categories: { id: string; name: string }[] }) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <p className="label-mono">Sent to admin</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-strong">Branch submission history</h2>
      {reports.length === 0 ? <p className="mt-3 text-sm text-fog/70">No branch summaries submitted yet.</p> : <div className="mt-4 flex flex-col gap-2">{reports.map((report) => <article key={report.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hair bg-panel/40 p-3"><div><p className="text-sm font-medium text-strong">{categories.find((category) => category.id === report.categoryId)?.name ?? "Branch"} · report date {report.reportDate}</p><p className="label-mono mt-1">Submitted {formatSubmittedAt(report.submittedAt)} · {report.sourceReportIds?.length ?? 0} source reports · locked</p></div><p className="num text-sm text-aurora-a">{report.totalUnits} units · {money(report.revenue)}</p></article>)}</div>}
    </section>
  );
}

function AdminSummary({ totals, reports }: { totals: { units: number; revenue: number; profit: number }; reports: number }) {
  return <div><div className="mb-3"><p className="label-mono text-aurora-a">Admin overview</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Sales performance</h2></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Summary label="Report sets counted" value={reports.toString()} /><Summary label="Units sold" value={totals.units.toString()} /><Summary label="Revenue / profit" value={`${money(totals.revenue)} / ${money(totals.profit)}`} /></div></div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <section className="glass rounded-2xl border-aurora-a/20 p-4 sm:p-5"><p className="label-mono">{label}</p><p className="num mt-3 text-xl font-semibold text-strong">{value}</p></section>; }

function AdminReports({ reports, categories, users }: { reports: Awaited<ReturnType<typeof listDailySalesReports>>; categories: { id: string; name: string }[]; users: { id: string; name: string; role?: User["role"] }[] }) {
  return (
    <section className="glass rounded-2xl border-aurora-a/20 p-4 sm:p-5">
      <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-aurora-a/15"><TrendingUp className="size-5 text-aurora-a" /></span><div><p className="label-mono">Admin analysis</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">All branch submissions</h2><p className="mt-1 text-sm text-fog/70">Staff reports and manager summaries across every branch.</p></div></div>
      {reports.length === 0 ? <p className="mt-4 text-sm text-fog/70">No staff or manager reports submitted yet.</p> : <div className="mt-4 flex flex-col gap-3">{reports.map((report) => { const submitter = users.find((user) => user.id === report.submittedBy); const reportKind = report.reportType === "branch-summary" ? "Manager summary" : submitter?.role === "manager" ? "Manager report" : "Staff report"; return <article key={report.id} className="rounded-xl border border-hair bg-panel/40 p-3 transition-colors hover:border-aurora-a/30 sm:p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium text-strong">{categories.find((category) => category.id === report.categoryId)?.name ?? "Unknown branch"} · {reportKind} · report date {report.reportDate}</p><p className="label-mono mt-1">Submitted by {submitter?.name ?? "Unknown user"} on {formatSubmittedAt(report.submittedAt)} · {report.totalUnits} units</p>{report.sourceReportIds && <p className="label-mono mt-1">Combined {report.sourceReportIds.length} staff and manager reports</p>}</div><div className="text-left sm:text-right"><p className="num font-semibold text-aurora-a">{money(report.revenue)}</p><p className="label-mono">Revenue · {money(report.profit)} profit</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{report.lines.map((line) => <p key={line.itemId} className="text-xs text-fog/75">{line.itemName}: {line.quantity} sold · {money(line.sellingPrice)} each</p>)}</div><p className="mt-3 flex items-center gap-1.5 text-xs text-amber"><LockKeyhole className="size-3" /> Locked after submission · contact administrator for corrections</p></article>; })}</div>}
    </section>
  );
}

function StaffHistory({ reports, categories }: { reports: Awaited<ReturnType<typeof listDailySalesReports>>; categories: { id: string; name: string }[] }) {
  return <section className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">History</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Your submitted reports</h2>{reports.length === 0 ? <p className="mt-4 text-sm text-fog/70">No reports submitted yet.</p> : <div className="mt-4 flex flex-col gap-2">{reports.map((report) => <div key={report.id} className="flex flex-col gap-2 rounded-xl border border-hair bg-panel/40 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-strong">{categories.find((category) => category.id === report.categoryId)?.name ?? "Unknown branch"} · report date {report.reportDate}</p><p className="label-mono mt-1">{report.totalUnits} units · submitted {formatSubmittedAt(report.submittedAt)} · locked</p></div><p className="num text-sm text-aurora-a">{money(report.revenue)} revenue</p></div>)}</div>}</section>;
}

function ManagerSalesHistory({ reports, categories, users }: { reports: Awaited<ReturnType<typeof listDailySalesReports>>; categories: { id: string; name: string }[]; users: { id: string; name: string }[] }) {
  return <section className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">Branch activity</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Sales submitted by your team</h2>{reports.length === 0 ? <p className="mt-4 text-sm text-fog/70">Your staff have not submitted any sales reports yet.</p> : <div className="mt-4 flex flex-col gap-3">{reports.map((report) => <article key={report.id} className="rounded-xl border border-hair bg-panel/40 p-3 sm:p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium text-strong">{categories.find((category) => category.id === report.categoryId)?.name ?? "Branch"} · report date {report.reportDate}</p><p className="label-mono mt-1">{users.find((member) => member.id === report.submittedBy)?.name ?? "Team member"} · submitted {formatSubmittedAt(report.submittedAt)} · {report.totalUnits} units · locked</p></div><div className="sm:text-right"><p className="num font-semibold text-aurora-a">{money(report.revenue)}</p><p className="label-mono">Revenue · {money(report.profit)} profit</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{report.lines.map((line) => <p key={line.itemId} className="text-xs text-fog/75">{line.itemName}: {line.quantity} sold · {money(line.sellingPrice)} each</p>)}</div></article>)}</div>}</section>;
}