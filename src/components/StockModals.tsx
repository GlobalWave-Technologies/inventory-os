import { useState } from "react";
import { toast } from "sonner";
import { GhostButton, PrimaryButton } from "@/components/AppShell";
import { Field, Modal } from "@/components/Modal";
import { useProducts } from "@/lib/catalog";
import { errorMessage } from "@/lib/errors";
import {
  useChangeStock,
  useMovements,
  useRequestStockIn,
  useSetThreshold,
  type MovementType,
  type StockRow,
} from "@/lib/stock";
import { useDebounced } from "@/lib/useDebounced";
import { useSingleFlight } from "@/lib/useSingleFlight";

export type ProductRef = { id: number; name: string; sku: string };

const MAX_QUANTITY = 1_000_000;

export type StockMode = "in" | "out" | "request";

const MODE_TEXT: Record<StockMode, { title: string; button: string; done: string }> = {
  in: { title: "Add stock", button: "Add stock", done: "added" },
  out: { title: "Remove stock", button: "Remove stock", done: "removed" },
  request: { title: "Request stock in", button: "Send request", done: "requested" },
};

export function StockActionModal({
  onClose,
  locationId,
  branchName,
  mode,
  product,
}: {
  onClose: () => void;
  locationId: number;
  branchName: string;
  mode: StockMode;
  product: ProductRef | null;
}) {
  const changeStock = useChangeStock();
  const requestStock = useRequestStockIn();
  const { run, pending } = useSingleFlight();
  const [picked, setPicked] = useState<ProductRef | null>(product);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const text = MODE_TEXT[mode];
  const busy = pending || changeStock.isPending || requestStock.isPending;

  async function submitNow() {
    if (!picked) {
      toast.error("Choose a product first.");
      return;
    }
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_QUANTITY) {
      toast.error("Enter a whole number of units, 1 or more.");
      return;
    }
    const note = reason.trim();
    if (mode === "request" && note.length < 3) {
      toast.error("Give a short reason, at least 3 characters.");
      return;
    }
    try {
      if (mode === "request") {
        await requestStock.mutateAsync({ locationId, productId: picked.id, quantity: amount, reason: note });
        toast.success(`Request sent: ${amount} × ${picked.name}`);
      } else {
        await changeStock.mutateAsync({
          direction: mode,
          locationId,
          productId: picked.id,
          quantity: amount,
          ...(note ? { reason: note } : {}),
        });
        toast.success(`${amount} × ${picked.name} ${text.done}`);
      }
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not update the stock."));
    }
  }

  return (
    <Modal open onClose={onClose} title={text.title} subtitle={branchName}>
      <div className="flex flex-col gap-4">
        {product ? (
          <p className="text-sm text-strong">
            {product.name} <span className="label-mono ml-1">{product.sku}</span>
          </p>
        ) : (
          <ProductPicker picked={picked} onPick={setPicked} />
        )}
        <Field label="Quantity">
          <input
            className="field"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label={mode === "request" ? "Reason" : "Reason (optional)"}>
          <input
            className="field"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === "out" ? "Damaged, given away…" : "Delivery, found in store…"}
          />
        </Field>
        {mode === "request" && (
          <p className="text-xs text-fog/70">
            Staff cannot add stock directly. An admin approves this request before the count changes.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void run(submitNow)} disabled={busy}>
            {busy ? "Saving…" : text.button}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function ProductPicker({
  picked,
  onPick,
}: {
  picked: ProductRef | null;
  onPick: (product: ProductRef) => void;
}) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const productsQuery = useProducts({ q, categoryId: null, includeInactive: false });
  const results = (productsQuery.data?.pages.flatMap((page) => page.items) ?? []).slice(0, 8);

  return (
    <Field label="Product">
      <input
        className="field"
        placeholder="Search by name (starts with)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {picked && (
        <p className="mt-2 text-sm text-aurora-a">
          Selected: {picked.name} <span className="label-mono ml-1">{picked.sku}</span>
        </p>
      )}
      <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
        {productsQuery.isLoading && <p className="text-xs text-fog/70">Searching…</p>}
        {!productsQuery.isLoading && results.length === 0 && (
          <p className="text-xs text-fog/70">No products found.</p>
        )}
        {results.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onPick({ id: entry.id, name: entry.name, sku: entry.sku })}
            className={`rounded-lg border px-3 py-2 text-left text-sm ${
              picked?.id === entry.id
                ? "border-aurora-a/50 bg-aurora-a/10 text-strong"
                : "border-hair text-fog hover:text-strong"
            }`}
          >
            {entry.name} <span className="label-mono ml-1">{entry.sku}</span>
          </button>
        ))}
      </div>
    </Field>
  );
}

export function ThresholdModal({
  onClose,
  locationId,
  branchName,
  row,
}: {
  onClose: () => void;
  locationId: number;
  branchName: string;
  row: StockRow;
}) {
  const setThreshold = useSetThreshold();
  const { run, pending } = useSingleFlight();
  const [minThreshold, setMinThreshold] = useState(String(row.minThreshold));
  const [shelf, setShelf] = useState(row.shelf ?? "");
  const busy = pending || setThreshold.isPending;

  async function saveNow() {
    const level = Number(minThreshold);
    if (!Number.isInteger(level) || level < 0 || level > MAX_QUANTITY) {
      toast.error("The low-stock level must be a whole number, 0 or more.");
      return;
    }
    try {
      await setThreshold.mutateAsync({
        locationId,
        productId: row.productId,
        minThreshold: level,
        shelf: shelf.trim(),
      });
      toast.success("Saved");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save."));
    }
  }

  return (
    <Modal open onClose={onClose} title="Low-stock level and shelf" subtitle={`${row.name} · ${branchName}`}>
      <div className="flex flex-col gap-4">
        <Field label="Warn me when the count is at or below">
          <input
            className="field"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={minThreshold}
            onChange={(e) => setMinThreshold(e.target.value)}
          />
        </Field>
        <Field label="Shelf or place in this branch (optional)">
          <input
            className="field"
            value={shelf}
            maxLength={100}
            onChange={(e) => setShelf(e.target.value)}
            placeholder="Aisle 3, back store…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void run(saveNow)} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export const TYPE_LABEL: Record<MovementType, string> = {
  stock_in: "Stock in",
  stock_out: "Stock out",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  adjustment: "Adjustment",
  sale: "Sale",
  return_in: "Return",
  purchase_in: "Purchase received",
};

export function HistoryModal({
  onClose,
  locationId,
  branchName,
  row,
}: {
  onClose: () => void;
  locationId: number;
  branchName: string;
  row: StockRow;
}) {
  const movementsQuery = useMovements(locationId, row.productId);
  const movements = movementsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Modal open onClose={onClose} title="Stock history" subtitle={`${row.name} · ${branchName}`}>
      {movementsQuery.isLoading && <p className="text-sm text-fog/70">Loading history…</p>}
      {movementsQuery.isError && (
        <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load the history.</p>
      )}
      {!movementsQuery.isLoading && !movementsQuery.isError && movements.length === 0 && (
        <p className="text-sm text-fog/70">No movements yet.</p>
      )}
      <div className="flex flex-col gap-2">
        {movements.map((movement) => (
          <div key={movement.id} className="rounded-xl border border-hair bg-panel/40 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-strong">{TYPE_LABEL[movement.type]}</p>
              <p className={`num text-sm font-semibold ${movement.change < 0 ? "text-rose" : "text-aurora-a"}`}>
                {movement.change > 0 ? `+${movement.change}` : movement.change}
              </p>
            </div>
            {movement.reason && <p className="mt-0.5 break-words text-xs text-fog/80">{movement.reason}</p>}
            <p className="label-mono mt-1">
              {new Date(movement.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              {" · "}
              {movement.userName ?? "System (before login)"}
            </p>
          </div>
        ))}
        {movementsQuery.hasNextPage && (
          <div className="flex justify-center pt-1">
            <GhostButton onClick={() => void movementsQuery.fetchNextPage()}>
              {movementsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </GhostButton>
          </div>
        )}
      </div>
    </Modal>
  );
}
