import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Modal, Field } from "./Modal";
import { GhostButton, PrimaryButton } from "./AppShell";
import { createCategory, updateCategory, uid, type AttributeDef, type Category } from "@/lib/db";
import { accentVar } from "@/lib/ledger";

const accents: Category["accent"][] = ["a", "b", "c", "amber", "rose"];
const types: AttributeDef["type"][] = ["text", "number", "date", "select"];

export function CategoryForm({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category?: Category | null;
}) {
  const [name, setName] = useState("");
  const [accent, setAccent] = useState<Category["accent"]>("a");
  const [attributes, setAttributes] = useState<AttributeDef[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setAccent(category?.accent ?? "a");
    setAttributes(category?.attributes ? category.attributes.map((a) => ({ ...a })) : []);
  }, [open, category]);

  const patchAttr = (id: string, patch: Partial<AttributeDef>) =>
    setAttributes((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  async function submit() {
    if (!name.trim()) return toast.error("Give the category a name.");
    const cleaned = attributes
      .filter((a) => a.name.trim())
      .map((a) => ({
        ...a,
        name: a.name.trim(),
        options:
          a.type === "select"
            ? (a.options ?? []).map((o) => o.trim()).filter(Boolean)
            : undefined,
      }));
    try {
      if (category) {
        await updateCategory(category.id, { name: name.trim(), accent, attributes: cleaned });
        toast.success(`${name.trim()} updated`);
      } else {
        await createCategory({ name: name.trim(), accent, attributes: cleaned });
        toast.success(`${name.trim()} created`);
      }
      onClose();
    } catch {
      toast.error("Couldn't save that category.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      subtitle="Define the fields items in this category should carry"
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category name">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Doors, Goats, Laptops…"
          />
        </Field>
        <Field label="Colour tag">
          <div className="flex items-center gap-2 pt-1.5">
            {accents.map((a) => (
              <button
                key={a}
                onClick={() => setAccent(a)}
                aria-label={`Colour ${a}`}
                className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  accent === a ? "border-strong" : "border-transparent"
                }`}
                style={{ backgroundColor: accentVar(a) }}
              />
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="label-mono">Custom fields</p>
          <button
            onClick={() =>
              setAttributes((l) => [...l, { id: uid(), name: "", type: "text", options: [] }])
            }
            className="flex items-center gap-1 rounded-lg border border-hair px-2.5 py-1 text-xs text-fog hover:text-strong"
          >
            <Plus className="size-3.5" /> Add field
          </button>
        </div>

        {attributes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-hair px-4 py-6 text-center text-xs text-fog/70">
            No custom fields yet. Add ones like “Material”, “Breed” or “Warranty ends”.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {attributes.map((attr) => (
              <div key={attr.id} className="rounded-2xl border border-hair bg-panel/40 p-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
                  <input
                    className="field"
                    placeholder="Field name"
                    value={attr.name}
                    onChange={(e) => patchAttr(attr.id, { name: e.target.value })}
                  />
                  <select
                    className="field"
                    value={attr.type}
                    onChange={(e) =>
                      patchAttr(attr.id, { type: e.target.value as AttributeDef["type"] })
                    }
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setAttributes((l) => l.filter((a) => a.id !== attr.id))}
                    aria-label="Remove field"
                    className="grid size-10 shrink-0 place-items-center justify-self-end rounded-xl border border-hair text-fog hover:text-rose"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {attr.type === "select" && (
                  <input
                    className="field mt-2"
                    placeholder="Choices, comma separated (Oak, Steel, Pine)"
                    value={(attr.options ?? []).join(", ")}
                    onChange={(e) => patchAttr(attr.id, { options: e.target.value.split(",") })}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={submit}>{category ? "Save changes" : "Create category"}</PrimaryButton>
      </div>
    </Modal>
  );
}
