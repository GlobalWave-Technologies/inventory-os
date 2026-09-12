import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PrimaryButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { CategoryForm } from "@/components/CategoryForm";
import { accentVar, useAccessibleCategories, useAccessibleItems } from "@/lib/ledger";
import { deleteCategory, type Category } from "@/lib/db";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories & custom fields — StockLine Inventory" },
      {
        name: "description",
        content:
          "Create categories such as Doors or Goats and give each one its own custom fields: text, number, date or dropdown.",
      },
      { property: "og:title", content: "Categories & custom fields — StockLine Inventory" },
      {
        property: "og:description",
        content: "Fully dynamic categories, each with its own attribute set.",
      },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const categories = useAccessibleCategories();
  const items = useAccessibleItems();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  async function remove(c: Category) {
    const count = (items ?? []).filter((i) => i.categoryId === c.id).length;
    if (!confirm(`Delete “${c.name}” and its ${count} item(s)? This cannot be undone.`)) return;
    await deleteCategory(c.id);
    toast.success(`${c.name} deleted`);
  }

  return (
    <AppShell
      eyebrow="Structure"
      title="Categories"
      actions={isAdmin ? (
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" /> New category
          </span>
        </PrimaryButton>
      ) : undefined}
    >
      {!categories || !items ? (
        <LoadingPanels count={3} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" />}
          title="No categories yet"
          body="Start with something real — Doors, Goats, Laptops — then add the fields those items carry."
          action={isAdmin ? (
            <PrimaryButton
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Create a category
            </PrimaryButton>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {categories.map((c, i) => {
              const mine = items.filter((it) => it.categoryId === c.id);
              const value = mine.reduce((s, it) => s + it.quantity * it.unitValue, 0);
              return (
                <motion.article
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: 0.05 * i, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className="glass card3d flex flex-col rounded-2xl p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: accentVar(c.accent) }}
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-base font-semibold text-strong">
                        {c.name}
                      </h2>
                      <p className="label-mono mt-0.5">
                        {mine.length} items · {money(value)}
                      </p>
                    </div>
                    {isAdmin && <div className="flex shrink-0 gap-1">
                      <button
                        aria-label={`Edit ${c.name}`}
                        onClick={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                        className="grid size-8 place-items-center rounded-lg border border-hair text-fog hover:text-strong"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        aria-label={`Delete ${c.name}`}
                        onClick={() => void remove(c)}
                        className="grid size-8 place-items-center rounded-lg border border-hair text-fog hover:text-rose"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.attributes.length === 0 ? (
                      <span className="text-xs text-fog/60">No custom fields</span>
                    ) : (
                      c.attributes.map((a) => (
                        <span
                          key={a.id}
                          className="rounded-lg border border-hair bg-panel/50 px-2 py-1 font-mono text-[11px] text-fog/85"
                        >
                          {a.name}
                          <span className="text-fog/45"> · {a.type}</span>
                        </span>
                      ))
                    )}
                  </div>

                  <Link
                    to="/items"
                    search={{ category: c.id }}
                    className="mt-4 text-xs text-aurora-a"
                  >
                    View {c.name} items →
                  </Link>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {isAdmin && <CategoryForm open={open} onClose={() => setOpen(false)} category={editing} />}
    </AppShell>
  );
}
