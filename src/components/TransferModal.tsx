import { useState } from "react";
import { toast } from "sonner";
import { GhostButton, PrimaryButton } from "@/components/AppShell";
import { Field, Modal } from "@/components/Modal";
import { ProductPicker, type ProductRef } from "@/components/StockModals";
import { errorMessage } from "@/lib/errors";
import { useBranchDirectory, useCreateTransfer } from "@/lib/transfers";
import { useSingleFlight } from "@/lib/useSingleFlight";

export function TransferModal({
  onClose,
  destinations,
  defaultDestinationId,
}: {
  onClose: () => void;
  /** Branches this person may ask stock to be sent to. */
  destinations: { id: number; name: string }[];
  defaultDestinationId: number | null;
}) {
  const create = useCreateTransfer();
  const directory = useBranchDirectory();
  const { run, pending } = useSingleFlight();
  const [toId, setToId] = useState<number | null>(defaultDestinationId ?? destinations[0]?.id ?? null);
  const [fromId, setFromId] = useState<number | null>(null);
  const [product, setProduct] = useState<ProductRef | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const busy = pending || create.isPending;
  const sources = (directory.data?.items ?? []).filter((b) => b.id !== toId);

  async function submitNow() {
    if (toId === null) {
      toast.error("Choose the branch that will receive the stock.");
      return;
    }
    if (fromId === null || fromId === toId) {
      toast.error("Choose a different branch to take the stock from.");
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
    try {
      await create.mutateAsync({
        fromLocationId: fromId,
        toLocationId: toId,
        productId: product.id,
        quantity: amount,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(expectedDate ? { expectedDate } : {}),
      });
      toast.success("Transfer requested");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not send the request."));
    }
  }

  return (
    <Modal open onClose={onClose} title="Request a transfer" subtitle="Ask another branch to send you stock.">
      <div className="flex flex-col gap-4">
        <Field label="Receiving branch (where the stock goes)">
          <select className="field" value={toId ?? ""} onChange={(e) => setToId(Number(e.target.value))}>
            {destinations.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sending branch (where the stock comes from)">
          <select className="field" value={fromId ?? ""} onChange={(e) => setFromId(Number(e.target.value))}>
            <option value="">{directory.isLoading ? "Loading…" : "Choose a branch"}</option>
            {sources.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <ProductPicker picked={product} onPick={setProduct} />
        <Field label="Quantity">
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
        <Field label="Reason (optional)">
          <input className="field" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Needed by (optional)">
          <input className="field" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
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
