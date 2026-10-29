import { useState } from "react";
import { toast } from "sonner";
import { GhostButton, PrimaryButton } from "@/components/AppShell";
import { Field, Modal } from "@/components/Modal";
import { ProductPicker, type ProductRef } from "@/components/StockModals";
import { errorMessage } from "@/lib/errors";
import { cedi } from "@/lib/format";
import {
  useCreateReturn,
  useCreateSalesReport,
  useCreateSummary,
  useReturnable,
  useSalesReport,
  type Condition,
  type ReasonCode,
} from "@/lib/sales";
import { useSingleFlight } from "@/lib/useSingleFlight";

type Branch = { id: number; name: string };
const today = () => new Date().toISOString().slice(0, 10);
const PRICE = /^\d{1,9}(\.\d{1,2})?$/;

function BranchField({ branches, value, onChange }: { branches: Branch[]; value: number | null; onChange: (id: number) => void }) {
  if (branches.length <= 1) return null;
  return (
    <Field label="Branch">
      <select className="field" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

// ---- New daily sales report --------------------------------------------------------------------

type Line = { product: ProductRef; quantity: string; price: string };

export function NewReportModal({ onClose, branches, defaultBranchId }: { onClose: () => void; branches: Branch[]; defaultBranchId: number | null }) {
  const create = useCreateSalesReport();
  const { run, pending } = useSingleFlight();
  const [locationId, setLocationId] = useState<number | null>(defaultBranchId ?? branches[0]?.id ?? null);
  const [reportDate, setReportDate] = useState(today());
  const [lines, setLines] = useState<Line[]>([]);
  const busy = pending || create.isPending;

  const addLine = (product: ProductRef) =>
    setLines((current) => (current.some((l) => l.product.id === product.id) ? current : [...current, { product, quantity: "", price: "" }]));
  const patchLine = (id: number, patch: Partial<Line>) =>
    setLines((current) => current.map((l) => (l.product.id === id ? { ...l, ...patch } : l)));

  async function submitNow() {
    if (locationId === null) {
      toast.error("Choose a branch.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one product you sold.");
      return;
    }
    const payload: { productId: number; quantity: number; sellingPrice?: string }[] = [];
    for (const line of lines) {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
        toast.error(`Enter a whole quantity for ${line.product.name}.`);
        return;
      }
      const price = line.price.trim();
      if (price && !PRICE.test(price)) {
        toast.error(`Price for ${line.product.name} must be cedis like 12.50.`);
        return;
      }
      payload.push({ productId: line.product.id, quantity, ...(price ? { sellingPrice: price } : {}) });
    }
    try {
      await create.mutateAsync({ locationId, reportDate, lines: payload });
      toast.success("Sales report submitted. Stock updated.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not submit the report."));
    }
  }

  return (
    <Modal open onClose={onClose} wide title="Daily sales report" subtitle="Everything you sold. Stock goes down when you submit.">
      <div className="flex flex-col gap-4">
        <BranchField branches={branches} value={locationId} onChange={setLocationId} />
        <Field label="Date of sales">
          <input className="field" type="date" max={today()} value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
        </Field>
        <ProductPicker picked={null} onPick={addLine} />
        {lines.length > 0 && (
          <div className="flex flex-col gap-2">
            {lines.map((line) => (
              <div key={line.product.id} className="rounded-xl border border-hair bg-panel/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-strong">
                    {line.product.name} <span className="label-mono ml-1">{line.product.sku}</span>
                  </p>
                  <button type="button" className="text-xs text-rose" onClick={() => setLines((c) => c.filter((l) => l.product.id !== line.product.id))}>
                    Remove
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="field"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="Quantity"
                    value={line.quantity}
                    onChange={(e) => patchLine(line.product.id, { quantity: e.target.value })}
                  />
                  <input
                    className="field"
                    inputMode="decimal"
                    placeholder="Price each (optional)"
                    value={line.price}
                    onChange={(e) => patchLine(line.product.id, { price: e.target.value })}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-fog/70">Leave the price empty to use the product's normal price.</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void run(submitNow)} disabled={busy}>
            {busy ? "Submitting…" : "Submit report"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ---- Close the day (branch summary) ------------------------------------------------------------

export function SummaryModal({ onClose, branches, defaultBranchId }: { onClose: () => void; branches: Branch[]; defaultBranchId: number | null }) {
  const create = useCreateSummary();
  const { run, pending } = useSingleFlight();
  const [locationId, setLocationId] = useState<number | null>(defaultBranchId ?? branches[0]?.id ?? null);
  const [reportDate, setReportDate] = useState(today());
  const busy = pending || create.isPending;

  async function submitNow() {
    if (locationId === null) {
      toast.error("Choose a branch.");
      return;
    }
    try {
      await create.mutateAsync({ locationId, reportDate });
      toast.success("Day closed. The branch summary is saved.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not close the day."));
    }
  }

  return (
    <Modal open onClose={onClose} title="Close the day" subtitle="Combines everyone's reports for that day into one branch summary.">
      <div className="flex flex-col gap-4">
        <BranchField branches={branches} value={locationId} onChange={setLocationId} />
        <Field label="Date">
          <input className="field" type="date" max={today()} value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
        </Field>
        <p className="text-xs text-fog/70">After this, staff can no longer add reports for that branch and date.</p>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void run(submitNow)} disabled={busy}>
            {busy ? "Saving…" : "Close the day"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ---- Report detail -----------------------------------------------------------------------------

export function ReportDetailModal({ onClose, reportId }: { onClose: () => void; reportId: number }) {
  const query = useSalesReport(reportId);
  const report = query.data;
  return (
    <Modal open onClose={onClose} title="Sales report" subtitle={report ? `${report.reportDate} · ${report.submittedByName}` : undefined}>
      {query.isLoading && <p className="text-sm text-fog/70">Loading…</p>}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load this report.</p>}
      {report && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="text-fog">Units sold</p>
            <p className="num text-right text-strong">{report.totalUnits}</p>
            <p className="text-fog">Revenue</p>
            <p className="num text-right text-strong">{cedi(report.revenue)}</p>
            {report.cost !== undefined && (
              <>
                <p className="text-fog">Cost</p>
                <p className="num text-right text-strong">{cedi(report.cost)}</p>
                <p className="text-fog">Profit</p>
                <p className="num text-right text-strong">{cedi(report.profit)}</p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {report.lines.map((line) => (
              <div key={line.productId} className="flex items-baseline justify-between gap-3 rounded-xl border border-hair bg-panel/40 px-3 py-2">
                <p className="min-w-0 truncate text-sm text-strong">{line.productName}</p>
                <p className="num shrink-0 text-xs text-fog">
                  {line.quantity} × → {cedi(line.revenue)}
                </p>
              </div>
            ))}
          </div>
          {report.type === "branch_summary" && (
            <p className="text-xs text-fog/70">Combines {report.sourceReportIds.length} individual report(s).</p>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---- New return --------------------------------------------------------------------------------

const REASONS: { value: ReasonCode; label: string }[] = [
  { value: "defective", label: "Defective" },
  { value: "wrong-item", label: "Wrong item" },
  { value: "changed-mind", label: "Changed mind" },
  { value: "other", label: "Other" },
];

export function NewReturnModal({ onClose, branches, defaultBranchId }: { onClose: () => void; branches: Branch[]; defaultBranchId: number | null }) {
  const create = useCreateReturn();
  const { run, pending } = useSingleFlight();
  const [locationId, setLocationId] = useState<number | null>(defaultBranchId ?? branches[0]?.id ?? null);
  const [product, setProduct] = useState<ProductRef | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reasonCode, setReasonCode] = useState<ReasonCode>("defective");
  const [condition, setCondition] = useState<Condition>("restock");
  const [reason, setReason] = useState("");
  const returnable = useReturnable(locationId, product?.id ?? null);
  const busy = pending || create.isPending;

  async function submitNow() {
    if (locationId === null || !product) {
      toast.error("Choose a branch and a product.");
      return;
    }
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
      toast.error("Enter a whole number of units, 1 or more.");
      return;
    }
    try {
      await create.mutateAsync({
        locationId,
        productId: product.id,
        quantity: amount,
        reasonCode,
        condition,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast.success(condition === "restock" ? "Return recorded. Stock added back." : "Return recorded.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not record the return."));
    }
  }

  return (
    <Modal open onClose={onClose} title="Record a return" subtitle="Only units this branch has sold can be returned.">
      <div className="flex flex-col gap-4">
        <BranchField branches={branches} value={locationId} onChange={setLocationId} />
        <ProductPicker picked={product} onPick={setProduct} />
        {product && returnable.data && (
          <p className="text-xs text-fog/80">
            Sold {returnable.data.sold}, returned {returnable.data.returned}. You can return up to {returnable.data.eligible}.
          </p>
        )}
        <Field label="Quantity">
          <input className="field" type="number" min={1} step={1} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Why is it coming back?">
          <select className="field" value={reasonCode} onChange={(e) => setReasonCode(e.target.value as ReasonCode)}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Condition">
          <select className="field" value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
            <option value="restock">Good, put back in stock</option>
            <option value="damaged">Damaged, do not restock</option>
          </select>
        </Field>
        <Field label="Note (optional)">
          <input className="field" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void run(submitNow)} disabled={busy}>
            {busy ? "Saving…" : "Record return"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
