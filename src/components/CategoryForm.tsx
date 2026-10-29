import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Modal, Field } from "./Modal";
import { GhostButton, PrimaryButton } from "./AppShell";
import {
  useCreateCategory,
  useUpdateCategory,
  type CategoryAccent,
  type CategoryInput,
  type CategoryRecord,
  type FieldType,
} from "@/lib/catalog";
import { errorMessage } from "@/lib/errors";
import { useSingleFlight } from "@/lib/useSingleFlight";
import { accentVar } from "@/lib/accent";

const accents: CategoryAccent[] = ["a", "b", "c", "amber", "rose"];
const types: FieldType[] = ["text", "number", "date", "select"];

// One editable row. `key` only identifies the row on screen; `id` exists once the server knows the field.
type FieldDraft = {
  key: string;
  id?: string;
  name: string;
  type: FieldType;
  optionsText: string;
  required: boolean;
};

let rowCounter = 0;
const nextKey = () => `row-${++rowCounter}`;

export function CategoryForm({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category?: CategoryRecord | null;
}) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const { run, pending } = useSingleFlight();
  const [name, setName] = useState("");
  const [accent, setAccent] = useState<CategoryAccent>("a");
  const [fields, setFields] = useState<FieldDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setAccent(category?.accent ?? "a");
    setFields(
      (category?.attributes ?? []).map((field) => ({
        key: nextKey(),
        id: field.id,
        name: field.name,
        type: field.type,
        optionsText: (field.options ?? []).join(", "),
        required: field.required,
      })),
    );
  }, [open, category]);

  const patchField = (key: string, patch: Partial<FieldDraft>) =>
    setFields((list) => list.map((field) => (field.key === key ? { ...field, ...patch } : field)));

  const saving = createCategory.isPending || updateCategory.isPending || pending;

  async function submitNow() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the category a name.");
      return;
    }

    const attributes: CategoryInput["attributes"] = [];
    for (const field of fields) {
      const fieldName = field.name.trim();
      if (!fieldName) continue;
      const options = field.optionsText
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean);
      if (field.type === "select" && options.length === 0) {
        toast.error(`Add at least one choice to “${fieldName}”.`);
        return;
      }
      attributes.push({
        ...(field.id ? { id: field.id } : {}),
        name: fieldName,
        type: field.type,
        ...(field.type === "select" ? { options } : {}),
        required: field.required,
      });
    }

    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, name: trimmed, accent, attributes });
        toast.success(`${trimmed} updated`);
      } else {
        await createCategory.mutateAsync({ name: trimmed, accent, attributes });
        toast.success(`${trimmed} created`);
      }
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save that category."));
    }
  }

  // Extra taps while one save is running are ignored.
  const submit = () => run(submitNow);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      subtitle="A type of item, such as Doors or Laptops, with the fields its products carry"
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category name">
          <input
            className="field"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Doors, Goats, Laptops…"
          />
        </Field>
        <Field label="Colour tag">
          <div className="flex items-center gap-2 pt-1.5">
            {accents.map((a) => (
              <button
                key={a}
                type="button"
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
            type="button"
            onClick={() =>
              setFields((list) => [
                ...list,
                { key: nextKey(), name: "", type: "text", optionsText: "", required: false },
              ])
            }
            className="flex items-center gap-1 rounded-lg border border-hair px-2.5 py-1 text-xs text-fog hover:text-strong"
          >
            <Plus className="size-3.5" /> Add field
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-hair px-4 py-6 text-center text-xs text-fog/70">
            No custom fields yet. Add ones like “Material”, “Breed” or “Warranty ends”.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <div key={field.key} className="rounded-2xl border border-hair bg-panel/40 p-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
                  <input
                    className="field"
                    placeholder="Field name"
                    value={field.name}
                    maxLength={60}
                    onChange={(e) => patchField(field.key, { name: e.target.value })}
                  />
                  <select
                    className="field"
                    value={field.type}
                    onChange={(e) => patchField(field.key, { type: e.target.value as FieldType })}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFields((list) => list.filter((f) => f.key !== field.key))}
                    aria-label="Remove field"
                    className="grid size-10 shrink-0 place-items-center justify-self-end rounded-xl border border-hair text-fog hover:text-rose"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {field.type === "select" && (
                  <input
                    className="field mt-2"
                    placeholder="Choices, comma separated (Oak, Steel, Pine)"
                    value={field.optionsText}
                    onChange={(e) => patchField(field.key, { optionsText: e.target.value })}
                  />
                )}
                <label className="mt-2 flex items-center gap-2 text-xs text-fog">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => patchField(field.key, { required: e.target.checked })}
                  />
                  Required when adding a product
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={() => void submit()} disabled={saving}>
          {saving ? "Saving…" : category ? "Save changes" : "Create category"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
