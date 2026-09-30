import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell, PrimaryButton, GhostButton } from "@/components/AppShell";
import { EmptyState, Field } from "@/components/Modal";
import { useAccessibleCategories, useAccessibleItems, useCategories } from "@/lib/ledger";
import {
  createBranchRequest,
  createPurchaseOrder,
  createSupplier,
  createTransfer,
  db,
  receivePurchaseOrder,
  receiveTransfer,
  reconcileStocktake,
  recordSaleReturn,
  recordStocktake,
  reviewBranchRequest,
  reviewTransfer,
  updateItem,
  type BranchRequest,
  type Category,
  type Item,
  type PurchaseOrder,
  type SaleReturn,
  type StockTransfer,
  type User,
} from "@/lib/db";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";

const sections = ["requests", "transfers", "stocktaking", "returns", "purchasing", "suppliers", "thresholds", "notifications"] as const;
type Section = (typeof sections)[number];

const titles: Record<Section, string> = {
  requests: "Requests & approvals",
  transfers: "Transfers",
  stocktaking: "Stocktaking",
  returns: "Sales & returns",
  purchasing: "Purchasing",
  suppliers: "Suppliers",
  thresholds: "Thresholds",
  notifications: "Notifications",
};

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: sections.find((section) => section === search["section"]) ?? "requests",
  }),
  head: () => ({ meta: [{ title: "Admin operations — StockLine Inventory" }] }),
  component: AdminOperations,
});

function AdminOperations() {
  const { section } = Route.useSearch();
  const { user, isAdmin, portalId } = useAuth();
  const categories = useAccessibleCategories() ?? [];
  const allCategories = useCategories() ?? categories;
  const items = useAccessibleItems() ?? [];
  const requests = useLiveQuery(() => db().branchRequests.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const transfers = useLiveQuery(() => db().transfers.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const counts = useLiveQuery(() => db().stocktakes.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const suppliers = useLiveQuery(() => db().suppliers.orderBy("name").toArray(), []) ?? [];
  const orders = useLiveQuery(() => db().purchaseOrders.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const returns = useLiveQuery(() => db().saleReturns.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const reports = useLiveQuery(() => db().dailySalesReports.orderBy("reportDate").reverse().toArray(), []) ?? [];
  const users = useLiveQuery(() => db().users.toArray(), []) ?? [];
  const [categoryId, setCategoryId] = useState("");
  const [itemId, setItemId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [itemName, setItemName] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [returnReasonCode, setReturnReasonCode] = useState<SaleReturn["reasonCode"]>("defective");
  const [returnCondition, setReturnCondition] = useState<SaleReturn["condition"]>("restock");
  const [unitCost, setUnitCost] = useState(0);
  const [supplierDraft, setSupplierDraft] = useState({ name: "", contact: "", email: "", notes: "" });
  const [thresholds, setThresholds] = useState<Record<string, string>>({});

  const pendingRequestCount = requests.filter((request) => request.status === "pending").length;
  const pendingTransferCount = transfers.filter((transfer) => transfer.status === "pending").length;
  const selectedItem = items.find((item) => item.id === itemId);
  const lowItems = useMemo(() => items.filter((item) => item.quantity <= item.lowStockThreshold), [items]);
  const canSeeBranch = (categoryId: string) => isAdmin || (!!user && categoryId === portalId && user.categoryIds.includes(categoryId));
  const visibleRequests = requests.filter((request) => canSeeBranch(request.categoryId));
  const visibleTransfers = transfers.filter((transfer) => canSeeBranch(transfer.sourceCategoryId) || canSeeBranch(transfer.destinationCategoryId));
  const visibleCounts = counts.filter((count) => canSeeBranch(count.categoryId));
  const visibleReturns = returns.filter((entry) => canSeeBranch(entry.categoryId));
  const visibleOrders = orders.filter((order) => canSeeBranch(order.categoryId));
  const branchSubmissionKeys = new Set(reports.filter((report) => report.reportType === "branch-summary").map((report) => `${report.categoryId}:${report.reportDate}`));
  const managerIds = new Set(users.filter((member) => member.role === "manager").map((member) => member.id));
  const visibleReports = reports.filter((report) => {
    if (!canSeeBranch(report.categoryId)) return false;
    if (!isAdmin) return report.reportType !== "branch-summary";
    return report.reportType === "branch-summary" || (managerIds.has(report.submittedBy) && !branchSubmissionKeys.has(`${report.categoryId}:${report.reportDate}`));
  });
  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      setItemName(""); setQuantity(1); setNote(""); setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The action could not be completed.");
    }
  }

  if (!user) return null;
  if ((!isAdmin && user.role === "manager" && !["requests", "transfers", "stocktaking", "returns", "purchasing", "suppliers", "thresholds", "notifications"].includes(section)) || (user.role === "staff" && section !== "requests" && section !== "notifications")) {
    return <AppShell eyebrow="Access" title="Admin access required"><EmptyState title="Admin access required" body="This operational section is available to administrators." /></AppShell>;
  }

  const title = titles[section];
  return (
    <AppShell eyebrow="Operations" title={title}>
      {section === "requests" && <section className="flex flex-col gap-4">
        <form className="glass rounded-2xl p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); const branch = isAdmin ? categoryId : categories[0]?.id; if (!branch) { toast.error("Choose a branch first."); return; } void run(() => createBranchRequest({ categoryId: branch, itemName, quantity, note, submittedBy: user.id }), "Request submitted for approval"); }}>
          <p className="label-mono">Branch request</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Request stock or supplies</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isAdmin && <Field label="Branch"><select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Choose branch</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>}
            <Field label="Item or supply"><input className="field" value={itemName} onChange={(event) => setItemName(event.target.value)} required /></Field>
            <Field label="Quantity"><input className="field" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></Field>
            <Field label="Reason"><input className="field" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" /></Field>
          </div>
          <PrimaryButton className="mt-4" type="submit">Submit request</PrimaryButton>
        </form>
        <section className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">{isAdmin ? "Approval queue" : "Your branch requests"}</p><div className="mt-3 flex flex-col gap-2">
          {visibleRequests.map((request) => <article key={request.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-hair p-3"><div className="min-w-0 flex-1"><p className="font-medium text-strong">{request.itemName} · {request.quantity}</p><p className="label-mono mt-1">{allCategories.find((category) => category.id === request.categoryId)?.name} · {users.find((member) => member.id === request.submittedBy)?.name} · {request.note || "No reason added"}</p></div><Status value={request.status} />{isAdmin && request.status === "pending" && <div className="flex gap-2"><button className="rounded-lg border border-hair px-3 py-2 text-xs text-aurora-a" onClick={() => void run(() => reviewBranchRequest(request.id, user.id, "approved"), "Request approved")}>Approve</button><button className="rounded-lg border border-hair px-3 py-2 text-xs text-rose" onClick={() => void run(() => reviewBranchRequest(request.id, user.id, "rejected"), "Request rejected")}>Reject</button></div>}</article>)}
          {visibleRequests.length === 0 && <p className="text-sm text-fog/65">No requests yet.</p>}
        </div></section>
      </section>}

      {section === "transfers" && <section className="flex flex-col gap-4">
        <form className="glass rounded-2xl p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); if (!selectedItem) { toast.error("Choose a stock item."); return; } void run(() => createTransfer({ itemId: selectedItem.id, sourceCategoryId: selectedItem.categoryId, destinationCategoryId: destinationId, quantity, createdBy: user.id }), "Transfer submitted for approval"); }}>
          <p className="label-mono">Warehouse movement</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Transfer stock between branches</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="From warehouse · item"><select className="field" value={itemId} onChange={(event) => setItemId(event.target.value)} required><option value="">Choose item</option>{items.filter((item) => item.status === "in-stock").map((item) => <option key={item.id} value={item.id}>{categories.find((category) => category.id === item.categoryId)?.name} · {item.name} ({item.quantity} available)</option>)}</select></Field><Field label="To warehouse"><select className="field" value={destinationId} onChange={(event) => setDestinationId(event.target.value)} required><option value="">Choose destination</option>{allCategories.filter((category) => category.id !== selectedItem?.categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Units"><input className="field" type="number" min={1} max={selectedItem?.quantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></Field></div>
          <PrimaryButton className="mt-4" type="submit">Request transfer</PrimaryButton>
        </form>
        <div className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">Transfer tracking</p><RecordList empty="No transfers yet." records={visibleTransfers} render={(transfer) => <><div className="min-w-0 flex-1"><p className="font-medium text-strong">{transfer.itemName || items.find((item) => item.id === transfer.itemId)?.name || "Item"} · {transfer.quantity} units</p><p className="label-mono mt-1">{allCategories.find((category) => category.id === transfer.sourceCategoryId)?.name ?? "Warehouse"} to {allCategories.find((category) => category.id === transfer.destinationCategoryId)?.name ?? "Warehouse"} · {transfer.trackingNumber}</p><p className="label-mono mt-1">Requested {transfer.createdAt.slice(0, 10)}{transfer.shippedAt ? ` · Dispatched ${transfer.shippedAt.slice(0, 10)}` : ""}{transfer.receivedAt ? ` · Arrived ${transfer.receivedAt.slice(0, 10)}` : ""}</p></div><Status value={transfer.status} />{isAdmin && transfer.status === "pending" && <div className="flex gap-2"><button className="rounded-lg border border-hair px-3 py-2 text-xs text-aurora-a" onClick={() => void run(() => reviewTransfer(transfer.id, user.id, "approved"), "Approved and dispatched; stock is now in transit")}>Approve & dispatch</button><button className="rounded-lg border border-hair px-3 py-2 text-xs text-rose" onClick={() => void run(() => reviewTransfer(transfer.id, user.id, "rejected"), "Transfer rejected")}>Reject</button></div>}{transfer.status === "in-transit" && canSeeBranch(transfer.destinationCategoryId) && <GhostButton onClick={() => void run(() => receiveTransfer(transfer.id, user.id), "Arrival confirmed; destination stock updated")}>Confirm arrival</GhostButton>}</>} /></div>
      </section>}

      {section === "stocktaking" && <section className="flex flex-col gap-4">
        <form className="glass rounded-2xl p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); if (!selectedItem) { toast.error("Choose an item."); return; } void run(() => recordStocktake({ itemId: selectedItem.id, categoryId: selectedItem.categoryId, countedQuantity: quantity, countedBy: user.id }), "Count recorded for review"); }}>
          <p className="label-mono">Physical count</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Record a stock count</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Branch item"><select className="field" value={itemId} onChange={(event) => setItemId(event.target.value)} required><option value="">Choose item</option>{items.map((item) => <option key={item.id} value={item.id}>{categories.find((category) => category.id === item.categoryId)?.name} · {item.name} ({item.quantity} expected)</option>)}</select></Field><Field label="Counted quantity"><input className="field" type="number" min={0} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></Field></div><PrimaryButton className="mt-4" type="submit">Save count</PrimaryButton>
        </form>
        <div className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">Count history</p><RecordList empty="No counts recorded." records={visibleCounts} render={(count) => <><div className="min-w-0 flex-1"><p className="font-medium text-strong">{items.find((item) => item.id === count.itemId)?.name ?? "Archived item"} · expected {count.expectedQuantity}, counted {count.countedQuantity}</p><p className="label-mono mt-1">Variance {count.countedQuantity - count.expectedQuantity} · {allCategories.find((category) => category.id === count.categoryId)?.name}</p></div>{count.reconciledAt ? <Status value="reconciled" /> : isAdmin && <GhostButton onClick={() => void run(() => reconcileStocktake(count.id, user.id), "Count reconciled into stock")}>Reconcile</GhostButton>}</>} /></div>
      </section>}

      {section === "returns" && <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-fog/75">Review sales summaries and record returned items for branch stock.</p><Link to="/reports" className="text-sm font-medium text-aurora-a hover:underline">Open daily sales reports</Link></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"><Metric label="Sales reports" value={String(visibleReports.length)} /><Metric label="Net units sold" value={String(items.reduce((sum, item) => sum + item.soldQuantity, 0))} /><Metric label="Unsold on hand" value={String(items.reduce((sum, item) => sum + item.quantity, 0))} /><Metric label="Damaged returns" value={String(items.reduce((sum, item) => sum + (item.damagedQuantity ?? 0), 0))} /><Metric label="Returns recorded" value={String(visibleReturns.length)} /></div>
        <form className="glass rounded-2xl p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); if (!selectedItem) { toast.error("Choose an item."); return; } void run(() => recordSaleReturn({ itemId: selectedItem.id, categoryId: selectedItem.categoryId, quantity, reasonCode: returnReasonCode, condition: returnCondition, reason, createdBy: user.id }), "Return recorded"); }}><p className="label-mono">Return intake</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Record a returned item</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Item"><select className="field" value={itemId} onChange={(event) => setItemId(event.target.value)} required><option value="">Choose item</option>{items.filter((item) => item.soldQuantity > 0).map((item) => <option key={item.id} value={item.id}>{categories.find((category) => category.id === item.categoryId)?.name} · {item.name} ({item.soldQuantity} net sold)</option>)}</select></Field><Field label="Units returned"><input className="field" type="number" min={1} max={selectedItem?.soldQuantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></Field><Field label="Reason code"><select className="field" value={returnReasonCode} onChange={(event) => setReturnReasonCode(event.target.value as SaleReturn["reasonCode"])}><option value="defective">Defective</option><option value="wrong-item">Wrong item</option><option value="changed-mind">Customer changed mind</option><option value="other">Other</option></select></Field><Field label="Returned condition"><select className="field" value={returnCondition} onChange={(event) => setReturnCondition(event.target.value as SaleReturn["condition"])}><option value="restock">Sellable · restock</option><option value="damaged">Damaged · write off</option></select></Field><Field label="Notes"><input className="field" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional details" /></Field></div><PrimaryButton className="mt-4" type="submit">Record return</PrimaryButton></form>
        <div className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">Return history</p><RecordList empty="No returns recorded." records={visibleReturns} render={(entry) => <><div className="min-w-0 flex-1"><p className="font-medium text-strong">{items.find((item) => item.id === entry.itemId)?.name ?? "Item"} · {entry.quantity} units · {entry.condition === "damaged" ? "written off" : "restocked"}</p><p className="label-mono mt-1">{entry.reasonCode.replaceAll("-", " ")}{entry.reason ? ` · ${entry.reason}` : ""} · {allCategories.find((category) => category.id === entry.categoryId)?.name}</p></div><time className="label-mono">{entry.createdAt.slice(0, 10)}</time></>} /></div>
      </section>}

      {section === "purchasing" && <section className="flex flex-col gap-4">
        <form className="glass rounded-2xl p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); if (!selectedItem || !supplierId) { toast.error("Choose a supplier and item."); return; } void run(() => createPurchaseOrder({ supplierId, itemId: selectedItem.id, categoryId: selectedItem.categoryId, quantity, unitCost, createdBy: user.id }), "Purchase order created"); }}><p className="label-mono">Purchase orders</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Order stock</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Supplier"><select className="field" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required><option value="">Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field label="Branch item"><select className="field" value={itemId} onChange={(event) => setItemId(event.target.value)} required><option value="">Choose item</option>{items.map((item) => <option key={item.id} value={item.id}>{categories.find((category) => category.id === item.categoryId)?.name} · {item.name}</option>)}</select></Field><Field label="Quantity"><input className="field" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></Field><Field label="Unit cost"><input className="field" type="number" min={0} step="0.01" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} required /></Field></div><PrimaryButton className="mt-4" type="submit">Create order</PrimaryButton></form>
        <div className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">Order history</p><RecordList empty="No purchase orders yet." records={visibleOrders} render={(order) => <><div className="min-w-0 flex-1"><p className="font-medium text-strong">{items.find((item) => item.id === order.itemId)?.name ?? "Item"} · {order.quantity} units · {money(order.unitCost)} each</p><p className="label-mono mt-1">{suppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? "Supplier"} · {allCategories.find((category) => category.id === order.categoryId)?.name}</p></div><Status value={order.status} />{isAdmin && order.status === "ordered" && <GhostButton onClick={() => void run(() => receivePurchaseOrder(order.id, user.id), "Purchase received and stock updated")}>Receive</GhostButton>}</>} /></div>
      </section>}

      {section === "suppliers" && <section className="flex flex-col gap-4">
        <form className="glass rounded-2xl p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); void run(() => createSupplier(supplierDraft), "Supplier saved").then(() => setSupplierDraft({ name: "", contact: "", email: "", notes: "" })); }}><p className="label-mono">Supplier directory</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Add supplier</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Company or contact name"><input className="field" value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} required /></Field><Field label="Phone"><input className="field" type="tel" value={supplierDraft.contact} onChange={(event) => setSupplierDraft({ ...supplierDraft, contact: event.target.value })} /></Field><Field label="Email"><input className="field" type="email" value={supplierDraft.email} onChange={(event) => setSupplierDraft({ ...supplierDraft, email: event.target.value })} /></Field><Field label="Notes"><input className="field" value={supplierDraft.notes} onChange={(event) => setSupplierDraft({ ...supplierDraft, notes: event.target.value })} /></Field></div><PrimaryButton className="mt-4" type="submit">Save supplier</PrimaryButton></form>
        <div className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">Saved suppliers</p><RecordList empty="No suppliers added." records={suppliers} render={(supplier) => <div className="min-w-0 flex-1"><p className="font-medium text-strong">{supplier.name}</p><p className="label-mono mt-1">{[supplier.contact, supplier.email, supplier.notes].filter(Boolean).join(" · ") || "No contact details"}</p></div>} /></div>
      </section>}

      {section === "thresholds" && <section className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">Stock alerts</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Reorder thresholds by item</h2><p className="mt-1 text-sm text-fog/70">Items become low stock when on-hand quantity is at or below this value.</p><div className="mt-4 flex flex-col gap-2">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-hair p-3"><div className="min-w-0 flex-1"><p className="font-medium text-strong">{item.name}</p><p className="label-mono mt-1">{categories.find((category) => category.id === item.categoryId)?.name} · on hand {item.quantity}</p></div><label className="label-mono flex items-center gap-2">Alert at <input className="field w-24" type="number" min={0} value={thresholds[item.id] ?? String(item.lowStockThreshold)} onChange={(event) => setThresholds({ ...thresholds, [item.id]: event.target.value })} /></label><GhostButton onClick={() => void run(async () => { const threshold = Number(thresholds[item.id] ?? item.lowStockThreshold); if (!Number.isInteger(threshold) || threshold < 0) throw new Error("Enter a whole number zero or higher."); await updateItem(item.id, { lowStockThreshold: threshold }); }, "Threshold updated")}>Save</GhostButton></div>)}{items.length === 0 && <p className="text-sm text-fog/65">Add items before setting thresholds.</p>}</div></section>}

      {section === "notifications" && <Notifications items={items} categories={allCategories} requests={visibleRequests} transfers={visibleTransfers} orders={visibleOrders} />}
    </AppShell>
  );
}

function Notifications({ items, categories, requests, transfers, orders }: { items: Item[]; categories: Category[]; requests: BranchRequest[]; transfers: StockTransfer[]; orders: PurchaseOrder[] }) {
  const alerts = [
    ...items.filter((item) => item.quantity <= item.lowStockThreshold).map((item) => ({ key: `low-${item.id}`, title: `${item.name} is low`, detail: `${categories.find((category) => category.id === item.categoryId)?.name} · ${item.quantity} on hand, alert at ${item.lowStockThreshold}`, tone: "text-amber" })),
    ...requests.filter((request) => request.status === "pending").map((request) => ({ key: `request-${request.id}`, title: `Request pending: ${request.itemName}`, detail: `${categories.find((category) => category.id === request.categoryId)?.name} · ${request.quantity} requested`, tone: "text-aurora-b" })),
    ...transfers.filter((transfer) => transfer.status === "pending" || transfer.status === "in-transit" || transfer.status === "received").map((transfer) => ({ key: `transfer-${transfer.id}`, title: transfer.status === "received" ? `Stock arrived: ${transfer.itemName}` : transfer.status === "in-transit" ? `Transfer in transit: ${transfer.itemName}` : `Transfer awaiting approval: ${transfer.itemName}`, detail: `${transfer.quantity} units · ${categories.find((category) => category.id === transfer.sourceCategoryId)?.name} to ${categories.find((category) => category.id === transfer.destinationCategoryId)?.name} · ${transfer.trackingNumber}${transfer.receivedAt ? ` · Arrived ${transfer.receivedAt.slice(0, 10)}` : ""}`, tone: transfer.status === "received" ? "text-aurora-a" : "text-aurora-b" })),
    ...orders.filter((order) => order.status === "ordered").map((order) => ({ key: `order-${order.id}`, title: "Purchase awaiting receipt", detail: `${order.quantity} units · ${categories.find((category) => category.id === order.categoryId)?.name}`, tone: "text-aurora-c" })),
  ];
  return <section className="glass rounded-2xl p-4 sm:p-5"><p className="label-mono">Live alerts</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Notifications</h2>{alerts.length === 0 ? <p className="mt-4 text-sm text-fog/70">You are all caught up.</p> : <div className="mt-4 flex flex-col gap-2">{alerts.map((alert) => <article key={alert.key} className="rounded-xl border border-hair p-3"><p className={`text-sm font-medium ${alert.tone}`}>{alert.title}</p><p className="label-mono mt-1">{alert.detail}</p></article>)}</div>}</section>;
}

function RecordList<T extends { id: string }>({ records, empty, render }: { records: T[]; empty: string; render: (record: T) => ReactNode }) {
  return <div className="mt-3 flex flex-col gap-2">{records.length ? records.map((record) => <article key={record.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-hair p-3">{render(record)}</article>) : <p className="text-sm text-fog/65">{empty}</p>}</div>;
}

function Status({ value }: { value: string }) {
  const tone = value === "approved" || value === "received" || value === "reconciled" ? "text-aurora-a" : value === "rejected" || value === "cancelled" ? "text-rose" : "text-amber";
  return <span className={`rounded-full border border-hair px-2.5 py-1 text-xs capitalize ${tone}`}>{value}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="glass rounded-2xl p-4"><p className="label-mono">{label}</p><p className="num mt-2 text-xl font-semibold text-strong">{value}</p></div>;
}