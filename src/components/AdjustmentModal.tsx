import { useState } from "react";
import { toast } from "sonner";
import { GhostButton, PrimaryButton } from "@/components/AppShell";
import { Field, Modal } from "@/components/Modal";
import { ProductPicker, type ProductRef } from "@/components/StockModals";
import { useCreateAdjustment } from "@/lib/adjustments";
import { errorMessage } from "@/lib/errors";
import { useSingleFlight } from "@/lib/useSingleFlight";

export function AdjustmentModal({
  onClose,
  branches,
  defaultBranchId,
}: {
  onClose: () => void;
  branches: { id: number; name: string }[];
  defaultBranchId: number | null;
}) {
  const create = useCreateAdjustment();
  const { run, pending } = useSingleFlight();
  const [locationId, setLocationId] = useState<number | null>(defaultBranchId ?? branches[0]?.id ?? null);
  const [product, setProduct] = useState<ProductRef | null>(null);
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const busy = pending || create.isPending;

  async function submitNow() {
    if (locationId === null) {
      toast.error("Choose a branch.");
      return;
    }
    if (!product) {
      toast.error("Choose a product first.");
      return;
    }
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
      toast.error("Enter a whole number of units, 1 or more.");
      return;
    }
    const note = reason.trim();
    if (note.length < 3) {
      toast.error("Give a reason, at least 3 characters.");
      return;
    }
    try {
      await create.mutateAsync({
        locationId,
        productId: product.id,
        change: direction === "up" ? amount : -amount,
        reason: note,
      });
      toast.success("Adjustment requested");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not send the request."));
    }
  }

  return (
    <Modal open onClose={onClose} title="Request a stock adjustment" subtitle="Fixes the count after a recount, damage or loss. Needs approval.">
      <div className="flex flex-col gap-4">
        {branches.length > 1 && (
          <Field label="Branch">
            <select className="field" value={locationId ?? ""} onChange={(e) => setLocationId(Number(e.target.value))}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <ProductPicker picked={product} onPick={setProduct} />
        <div className="grid grid-cols-2 gap-2">
          <GhostButton onClick={() => setDirection("down")} className={direction === "down" ? "!border-aurora-a/50 !text-strong" : ""}>
            Decrease
          </GhostButton>
          <GhostButton onClick={() => setDirection("up")} className={direction === "up" ? "!border-aurora-a/50 !text-strong" : ""}>
            Increase
          </GhostButton>
        </div>
        <Field label="Units to change by">
          <input
            className="field"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Reason">
          <input
            className="field"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Recount found 3 fewer, damaged in store…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void run(submitNow)} disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
