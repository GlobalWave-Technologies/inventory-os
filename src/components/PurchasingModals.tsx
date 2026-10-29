import { useState } from "react";
import { toast } from "sonner";
import { GhostButton, PrimaryButton } from "@/components/AppShell";
import { Field, Modal } from "@/components/Modal";
import { ProductPicker, type ProductRef } from "@/components/StockModals";
import { errorMessage } from "@/lib/errors";
import {
  useCreateOrder,
  useCreateStockRequest,
  useCreateSupplier,
  useSuppliers,
  useUpdateSupplier,
  type Supplier,
} from "@/lib/purchasing";
import { useSingleFlight } from "@/lib/useSingleFlight";

type Branch = { id: number; name: string };
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

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

// ---- Supplier --------------------------------------------------------------------------------

export function SupplierModal({ onClose, supplier }: { onClose: () => void; supplier: Supplier | null }) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const { run, pending } = useSingleFlight();
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const busy = pending || create.isPending || update.isPending;

  async function saveNow() {
    if (!name.trim()) {
      toast.error("Enter the supplier's name.");
      return;
    }
    const input = { name: name.trim(), contact: contact.trim(), email: email.trim(), notes: notes.trim() };
    try {
      if (supplier) await update.mutateAsync({ id: supplier.id, ...input });
      else await create.mutateAsync(input);
      toast.success(supplier ? "Supplier updated" : "Supplier added");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the supplier."));
    }
  }

  return (
    <Modal open onClose={onClose} title={supplier ? "Edit supplier" : "Add supplier"}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className="field" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Contact person or phone">
          <input className="field" maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="field" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Notes">
          <input className="field" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

// ---- Purchase order --------------------------------------------------------------------------

export function OrderModal({ onClose, branches, defaultBranchId }: { onClose: () => void; branches: Branch[]; defaultBranchId: number | null }) {
  const create = useCreateOrder();
  const suppliers = useSuppliers(true);
  const { run, pending } = useSingleFlight();
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(defaultBranchId ?? branches[0]?.id ?? null);
  const [product, setProduct] = useState<ProductRef | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const busy = pending || create.isPending;
  const list = suppliers.data?.pages.flatMap((page) => page.items) ?? [];

  async function saveNow() {
    if (supplierId === null || locationId === null || !product) {
      toast.error("Choose a supplier, a branch and a product.");
      return;
    }
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
      toast.error("Enter a whole number of units, 1 or more.");
      return;
    }
    if (!MONEY.test(unitCost.trim())) {
      toast.error("Enter the cost of one unit in cedis, like 12.50.");
      return;
    }
    try {
      await create.mutateAsync({ supplierId, locationId, productId: product.id, quantity: amount, unitCost: unitCost.trim() });
      toast.success("Order placed");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not place the order."));
    }
  }

  return (
    <Modal open onClose={onClose} title="New purchase order" subtitle="Stock is added when the order is received.">
      <div className="flex flex-col gap-4">
        <Field label="Supplier">
          <select className="field" value={supplierId ?? ""} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{suppliers.isLoading ? "Loading…" : list.length === 0 ? "Add a supplier first" : "Choose a supplier"}</option>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <BranchField branches={branches} value={locationId} onChange={setLocationId} />
        <ProductPicker picked={product} onPick={setProduct} />
        <Field label="Quantity">
          <input className="field" type="number" min={1} step={1} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Cost of one unit (GH₵)">
          <input className="field" inputMode="decimal" placeholder="12.50" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void run(saveNow)} disabled={busy}>
            {busy ? "Placing…" : "Place order"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ---- Stock request ---------------------------------------------------------------------------

export function RequestModal({ onClose, branches, defaultBranchId }: { onClose: () => void; branches: Branch[]; defaultBranchId: number | null }) {
  const create = useCreateStockRequest();
  const { run, pending } = useSingleFlight();
  const [locationId, setLocationId] = useState<number | null>(defaultBranchId ?? branches[0]?.id ?? null);
  const [product, setProduct] = useState<ProductRef | null>(null);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const busy = pending || create.isPending;

  async function saveNow() {
    if (locationId === null) {
      toast.error("Choose a branch.");
      return;
    }
    const name = itemName.trim();
    if (!name) {
      toast.error("Say what you need, or pick it from the catalogue.");
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
        itemName: name,
        quantity: amount,
        ...(product ? { productId: product.id } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success("Request sent");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not send the request."));
    }
  }

  return (
    <Modal open onClose={onClose} title="Request stock" subtitle="Tell your manager what you need more of.">
      <div className="flex flex-col gap-4">
        <BranchField branches={branches} value={locationId} onChange={setLocationId} />
        <ProductPicker
          picked={product}
          onPick={(p) => {
            setProduct(p);
            setItemName(p.name);
          }}
        />
        <Field label="What do you need? (you can type something not in the catalogue)">
          <input className="field" maxLength={200} value={itemName} onChange={(e) => setItemName(e.target.value)} />
        </Field>
        <Field label="Quantity">
          <input className="field" type="number" min={1} step={1} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input className="field" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void run(saveNow)} disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
