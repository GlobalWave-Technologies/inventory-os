import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal, Field } from "./Modal";
import { GhostButton, PrimaryButton } from "./AppShell";
import {
  addStock,
  useCreateProduct,
  useUpdateProduct,
  type CategoryRecord,
  type ProductInput,
  type ProductPatch,
  type ProductRecord,
} from "@/lib/catalog";
import type { BranchRecord } from "@/lib/branches";
import { errorMessage } from "@/lib/errors";
import { useSingleFlight } from "@/lib/useSingleFlight";

// Same rule the server uses: up to 9 digits and at most 2 decimals, as text.
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

type Draft = {
  name: string;
  categoryId: string;
  sku: string;
  barcode: string;
  notes: string;
  price: string;
  cost: string;
  custom: Record<string, string>; // keyed by the category field's id
  stockBranchId: string;
  stockQuantity: string;
};

const emptyDraft = (categoryId: string): Draft => ({
  name: "",
  categoryId,
  sku: "",
  barcode: "",
  notes: "",
  price: "",
  cost: "",
  custom: {},
  stockBranchId: "",
  stockQuantity: "",
});

export function ProductForm({
  open,
  onClose,
  categories,
  branches,
  product,
  defaultCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryRecord[];
  branches: BranchRecord[];
  product?: ProductRecord | null;
  defaultCategoryId?: number | null;
}) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { run, pending } = useSingleFlight();
  const [draft, setDraft] = useState<Draft>(emptyDraft(""));

  useEffect(() => {
    if (!open) return;
    if (product) {
      setDraft({
        name: product.name,
        categoryId: product.categoryId === null ? "" : String(product.categoryId),
        sku: product.sku,
        barcode: product.barcode ?? "",
        notes: product.notes ?? "",
        price: product.price,
        cost: product.cost ?? "",
        custom: Object.fromEntries(
          Object.entries(product.custom).map(([id, value]) => [id, String(value)]),
        ),
        stockBranchId: "",
        stockQuantity: "",
      });
    } else {
      const first = defaultCategoryId ?? categories[0]?.id ?? null;
      setDraft(emptyDraft(first === null ? "" : String(first)));
    }
  }, [open, product, defaultCategoryId, categories]);

  const category = useMemo(
    () => categories.find((entry) => String(entry.id) === draft.categoryId),
    [categories, draft.categoryId],
  );

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const saving = createProduct.isPending || updateProduct.isPending || pending;

  // Turns the typed values into the shape the server expects. Returns null after showing why not.
  function buildCustom(): Record<string, string | number> | null {
    const custom: Record<string, string | number> = {};
    for (const field of category?.attributes ?? []) {
      const raw = (draft.custom[field.id] ?? "").trim();
      if (raw === "") {
        if (field.required) {
          toast.error(`${field.name} is required.`);
          return null;
        }
        continue;
      }
      if (field.type === "number") {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          toast.error(`${field.name} must be a number.`);
          return null;
        }
        custom[field.id] = value;
      } else {
        custom[field.id] = raw;
      }
    }
    return custom;
  }

  async function submitNow() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the product a name first.");
      return;
    }
    if (!category) {
      toast.error("Pick a category for this product.");
      return;
    }

    const price = draft.price.trim();
    const cost = draft.cost.trim();
    if (price && !MONEY.test(price)) {
      toast.error('Enter the price like "12.50".');
      return;
    }
    if (cost && !MONEY.test(cost)) {
      toast.error('Enter the cost like "8.00".');
      return;
    }

    const custom = buildCustom();
    if (!custom) return;

    try {
      if (product) {
        const patch: ProductPatch = {
          id: product.id,
          name,
          categoryId: category.id,
          custom,
          notes: draft.notes.trim(),
          ...(price ? { price } : {}),
          ...(cost ? { cost } : {}),
        };
        const barcode = draft.barcode.trim();
        if (barcode) patch.barcode = barcode;
        else if (product.barcode) patch.barcode = null; // cleared on purpose
        await updateProduct.mutateAsync(patch);
        toast.success(`${name} updated`);
        onClose();
        return;
      }

      const quantity = Number(draft.stockQuantity || "0");
      if (!Number.isInteger(quantity) || quantity < 0) {
        toast.error("Opening stock must be a whole number.");
        return;
      }
      if (quantity > 0 && !draft.stockBranchId) {
        toast.error("Choose the branch that receives the opening stock.");
        return;
      }

      const input: ProductInput = {
        name,
        categoryId: category.id,
        custom,
        ...(draft.sku.trim() ? { sku: draft.sku.trim() } : {}),
        ...(draft.barcode.trim() ? { barcode: draft.barcode.trim() } : {}),
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        ...(price ? { price } : {}),
        ...(cost ? { cost } : {}),
      };
      const created = await createProduct.mutateAsync(input);

      if (quantity > 0) {
        try {
          await addStock({
            locationId: Number(draft.stockBranchId),
            productId: created.id,
            quantity,
          });
          toast.success(`${name} created with ${quantity} in stock`);
        } catch (error) {
          // The product exists; only the stock step failed, so say exactly that.
          toast.error(`${name} was created, but the opening stock failed: ${errorMessage(error, "try again from Inventory.")}`);
        }
      } else {
        toast.success(`${name} created`);
      }
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save that product."));
    }
  }

  // Extra taps while one save is running are ignored.
  const submit = () => run(submitNow);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Edit product" : "Create product"}
      subtitle={product ? product.sku : "Add something you sell or keep in stock"}
      wide
    >
      {categories.length === 0 ? (
        <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">
          Create a category first. Every product belongs to one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name">
            <input
              className="field"
              value={draft.name}
              maxLength={200}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Oak door, 80cm"
            />
          </Field>
          <Field label="Category">
            <select
              className="field"
              value={draft.categoryId}
              onChange={(e) => set({ categoryId: e.target.value, custom: {} })}
            >
              {categories.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Selling price (GHS)">
            <input
              className="field"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => set({ price: e.target.value })}
              placeholder="0.00"
            />
          </Field>
          <Field label="Cost price (GHS)">
            <input
              className="field"
              inputMode="decimal"
              value={draft.cost}
              onChange={(e) => set({ cost: e.target.value })}
              placeholder="0.00"
            />
          </Field>
          {!product && (
            <Field label="SKU (optional)">
              <input
                className="field"
                value={draft.sku}
                maxLength={64}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="Made automatically if empty"
              />
            </Field>
          )}
          <Field label="Barcode (optional)">
            <input
              className="field"
              value={draft.barcode}
              maxLength={64}
              onChange={(e) => set({ barcode: e.target.value })}
            />
          </Field>

          {(category?.attributes.length ?? 0) > 0 && (
            <div className="sm:col-span-2">
              <p className="label-mono mb-2 mt-1">{category?.name} fields</p>
              <div className="grid gap-4 rounded-2xl border border-hair bg-panel/40 p-4 sm:grid-cols-2">
                {category?.attributes.map((field) => (
                  <Field key={field.id} label={field.required ? `${field.name} *` : field.name}>
                    {field.type === "select" ? (
                      <select
                        className="field"
                        value={draft.custom[field.id] ?? ""}
                        onChange={(e) => set({ custom: { ...draft.custom, [field.id]: e.target.value } })}
                      >
                        <option value="">—</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="field"
                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                        value={draft.custom[field.id] ?? ""}
                        onChange={(e) => set({ custom: { ...draft.custom, [field.id]: e.target.value } })}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          )}

          {!product && (
            <div className="sm:col-span-2">
              <p className="label-mono mb-2 mt-1">Opening stock (optional)</p>
              <div className="grid gap-4 rounded-2xl border border-hair bg-panel/40 p-4 sm:grid-cols-2">
                <Field label="Branch">
                  <select
                    className="field"
                    value={draft.stockBranchId}
                    onChange={(e) => set({ stockBranchId: e.target.value })}
                  >
                    <option value="">No opening stock</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    className="field"
                    type="number"
                    min={0}
                    step={1}
                    value={draft.stockQuantity}
                    onChange={(e) => set({ stockQuantity: e.target.value })}
                    placeholder="0"
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                className="field min-h-20"
                value={draft.notes}
                maxLength={2000}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Anything worth remembering about this product"
              />
            </Field>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        {categories.length > 0 && (
          <PrimaryButton onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : product ? "Save changes" : "Create product"}
          </PrimaryButton>
        )}
      </div>
    </Modal>
  );
}
