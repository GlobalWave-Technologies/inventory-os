import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal, Field } from "./Modal";
import { PrimaryButton, GhostButton } from "./AppShell";
import { createItem, updateItem, type Category, type Item, type ItemStatus } from "@/lib/db";

const statuses: ItemStatus[] = ["in-stock", "reserved", "damaged", "archived"];

type Draft = {
  categoryId: string;
  name: string;
  quantity: string;
  soldQuantity: string;
  lowStockThreshold: string;
  location: string;
  originalPrice: string;
  sellingPrice: string;
  status: ItemStatus;
  dateAdded: string;
  notes: string;
  custom: Record<string, string>;
};

const emptyDraft = (categoryId: string): Draft => ({
  categoryId,
  name: "",
  quantity: "0",
  soldQuantity: "0",
  lowStockThreshold: "5",
  location: "",
  originalPrice: "0",
  sellingPrice: "0",
  status: "in-stock",
  dateAdded: new Date().toISOString().slice(0, 10),
  notes: "",
  custom: {},
});

export function ItemForm({
  open,
  onClose,
  categories,
  item,
  defaultCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  item?: Item | null;
  defaultCategoryId?: string;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft(defaultCategoryId ?? categories[0]?.id ?? ""));

  useEffect(() => {
    if (!open) return;
    if (item) {
      setDraft({
        categoryId: item.categoryId,
        name: item.name,
        quantity: String(item.quantity),
        soldQuantity: String(item.soldQuantity),
        lowStockThreshold: String(item.lowStockThreshold),
        location: item.location,
        originalPrice: String(item.originalPrice),
        sellingPrice: String(item.sellingPrice),
        status: item.status,
        dateAdded: item.dateAdded.slice(0, 10),
        notes: item.notes ?? "",
        custom: Object.fromEntries(
          Object.entries(item.custom ?? {}).map(([k, v]) => [k, String(v)]),
        ),
      });
    } else {
      setDraft(emptyDraft(defaultCategoryId ?? categories[0]?.id ?? ""));
    }
  }, [open, item, defaultCategoryId, categories]);

  const category = useMemo(
    () => categories.find((c) => c.id === draft.categoryId),
    [categories, draft.categoryId],
  );

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit() {
    if (!draft.name.trim()) return toast.error("Give the item a name first.");
    if (!draft.categoryId) return toast.error("Pick a category for this item.");

    const custom: Record<string, string | number> = {};
    for (const attr of category?.attributes ?? []) {
      const raw = draft.custom[attr.name] ?? "";
      if (attr.required && !raw) return toast.error(`${attr.name} is required.`);
      if (raw === "") continue;
      custom[attr.name] = attr.type === "number" ? Number(raw) : raw;
    }

    const payload = {
      categoryId: draft.categoryId,
      name: draft.name.trim(),
      quantity: Math.max(0, Number(draft.quantity) || 0),
      soldQuantity: Math.max(0, Number(draft.soldQuantity) || 0),
      lowStockThreshold: Math.max(0, Number(draft.lowStockThreshold) || 0),
      location: draft.location.trim(),
      originalPrice: Math.max(0, Number(draft.originalPrice) || 0),
      sellingPrice: Math.max(0, Number(draft.sellingPrice) || 0),
      status: draft.status,
      dateAdded: new Date(draft.dateAdded).toISOString(),
      notes: draft.notes.trim(),
      custom,
    };

    try {
      if (item) {
        await updateItem(item.id, payload);
        toast.success(`${payload.name} updated`);
      } else {
        await createItem(payload);
        toast.success(`${payload.name} added to stock`);
      }
      onClose();
    } catch {
      toast.error("Couldn't save that item. Please try again.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "Edit item" : "Add item"}
      subtitle={category ? `${category.name} · values in Ghana cedis` : "Values in Ghana cedis"}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Item name">
            <input
              className="field"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Steel fire door, 900mm"
            />
          </Field>
        </div>

        <Field label="Category">
          <select
            className="field"
            value={draft.categoryId}
            onChange={(e) => set({ categoryId: e.target.value, custom: {} })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select
            className="field"
            value={draft.status}
            onChange={(e) => set({ status: e.target.value as ItemStatus })}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace("-", " ")}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quantity">
          <input
            type="number"
            min={0}
            className="field num"
            value={draft.quantity}
            onChange={(e) => set({ quantity: e.target.value })}
          />
        </Field>

        <Field label="Low-stock alert at">
          <input
            type="number"
            min={0}
            className="field num"
            value={draft.lowStockThreshold}
            onChange={(e) => set({ lowStockThreshold: e.target.value })}
          />
        </Field>

        <Field label="Units sold">
          <input
            type="number"
            min={0}
            step="1"
            className="field num"
            value={draft.soldQuantity}
            onChange={(e) => set({ soldQuantity: e.target.value })}
          />
        </Field>

        <Field label="Original price (GH₵)">
          <input
            type="number"
            min={0}
            step="0.01"
            className="field num"
            value={draft.originalPrice}
            onChange={(e) => set({ originalPrice: e.target.value })}
          />
        </Field>

        <Field label="Sold price (GH₵)">
          <input
            type="number"
            min={0}
            step="0.01"
            className="field num"
            value={draft.sellingPrice}
            onChange={(e) => set({ sellingPrice: e.target.value })}
          />
        </Field>

        <Field label="Date added">
          <input
            type="date"
            className="field"
            value={draft.dateAdded}
            onChange={(e) => set({ dateAdded: e.target.value })}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Location">
            <input
              className="field"
              value={draft.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder="Warehouse B, Tema"
            />
          </Field>
        </div>

        {(category?.attributes.length ?? 0) > 0 && (
          <div className="sm:col-span-2">
            <p className="label-mono mb-2 mt-1">{category?.name} fields</p>
            <div className="grid gap-4 rounded-2xl border border-hair bg-panel/40 p-4 sm:grid-cols-2">
              {category?.attributes.map((attr) => (
                <Field key={attr.id} label={attr.name}>
                  {attr.type === "select" ? (
                    <select
                      className="field"
                      value={draft.custom[attr.name] ?? ""}
                      onChange={(e) =>
                        set({ custom: { ...draft.custom, [attr.name]: e.target.value } })
                      }
                    >
                      <option value="">—</option>
                      {(attr.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="field"
                      type={attr.type === "number" ? "number" : attr.type === "date" ? "date" : "text"}
                      value={draft.custom[attr.name] ?? ""}
                      onChange={(e) =>
                        set({ custom: { ...draft.custom, [attr.name]: e.target.value } })
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}

        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea
              className="field min-h-20"
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Anything worth remembering about this item"
            />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={submit}>{item ? "Save changes" : "Add item"}</PrimaryButton>
      </div>
    </Modal>
  );
}
