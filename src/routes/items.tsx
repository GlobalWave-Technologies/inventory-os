import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Minus, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { EmptyState, Field, LoadingPanels, Modal } from "@/components/Modal";
import { ItemForm } from "@/components/ItemForm";
import { accentVar, isLow, statusLabel, useAccessibleCategories, useItemHistory, useAccessibleItems } from "@/lib/ledger";
import { adjustStock, deleteItem, type Item } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { money, shortDate, timeAgo } from "@/lib/format";

type ItemSearch = { category?: string };

export const Route = createFileRoute("/items")({
  validateSearch: (search: Record<string, unknown>): ItemSearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Items & stock levels in GH₵ — StockLine Inventory" },
      {
        name: "description",
        content:
          "Search and filter every item by category, name or custom field value, with quantities and values shown in Ghana cedis.",
      },
      { property: "og:title", content: "Items & stock levels in GH₵ — StockLine Inventory" },
      {
        property: "og:description",
        content: "Search, filter and adjust stock, with values in Ghana cedis.",
      },
    ],
  }),
  component: ItemsPage,
});

function ItemsPage() {
  const { category } = Route.useSearch();
  const navigate = Route.useNavigate();
  const items = useAccessibleItems();
  const categories = useAccessibleCategories();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Item["status"]>("all");
  const [stockLevel, setStockLevel] = useState<"all" | "low" | "healthy">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [detail, setDetail] = useState<Item | null>(null);
  const [adjusting, setAdjusting] = useState<Item | null>(null);
  const [page, setPage] = useState(1);
  const branchItems = useMemo(
    () => (items ?? []).filter((item) => (category ? item.categoryId === category : true)),
    [items, category],
  );
  const branchName = categories?.find((entry) => entry.id === category)?.name;
  const lowStockCount = branchItems.filter(isLow).length;
  const healthyStockCount = branchItems.length - lowStockCount;
  const soldUnits = branchItems.reduce((total, item) => total + item.soldQuantity, 0);
  const availableUnits = branchItems
    .filter((item) => item.status === "in-stock")
    .reduce((total, item) => total + item.quantity, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return branchItems
      .filter((i) => (status === "all" ? true : i.status === status))
      .filter((i) => stockLevel === "all" ? true : stockLevel === "low" ? isLow(i) : !isLow(i))
      .filter((i) => {
        if (!q) return true;
        if (i.name.toLowerCase().includes(q) || i.location.toLowerCase().includes(q)) return true;
        return Object.entries(i.custom ?? {}).some(([k, v]) =>
          `${k} ${v}`.toLowerCase().includes(q),
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [branchItems, status, stockLevel, query]);

  const live = detail ? ((items ?? []).find((i) => i.id === detail.id) ?? detail) : null;
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function remove(item: Item) {
    if (!confirm(`Delete “${item.name}”?`)) return;
    await deleteItem(item.id);
    setDetail(null);
    toast.success(`${item.name} deleted`);
  }

  return (
    <AppShell
      eyebrow={branchName ? "Branch stock" : "Stock"}
      title={branchName ?? "Items"}
      actions={
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" /> Add item
          </span>
        </PrimaryButton>
      }
    >
      <div className="glass mb-4 flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
        {branchName && <p className="label-mono px-1">{branchName} inventory</p>}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog/50" />
          <input
            className="field !pl-9"
            placeholder="Search name, location or any custom field…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterChip
            active={!category}
            onClick={() => void navigate({ search: {} })}
            label={user?.role === "admin" ? "All branches" : "All categories"}
          />
          {(categories ?? []).map((c) => (
            <FilterChip
              key={c.id}
              active={category === c.id}
              onClick={() => void navigate({ search: { category: c.id } })}
              label={c.name}
              dot={accentVar(c.accent)}
            />
          ))}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {(["all", "in-stock", "reserved", "damaged", "archived"] as const).map((s) => (
            <FilterChip
              key={s}
              active={status === s}
              onClick={() => setStatus(s)}
              label={s === "all" ? "Any status" : statusLabel[s]}
            />
          ))}
          <FilterChip active={stockLevel === "low"} onClick={() => setStockLevel((level) => level === "low" ? "all" : "low")} label={`Low stock (${branchName ? lowStockCount : ""})`} />
          <FilterChip active={stockLevel === "healthy"} onClick={() => setStockLevel((level) => level === "healthy" ? "all" : "healthy")} label={`Above alert (${branchName ? healthyStockCount : ""})`} />
        </div>
      </div>

      {branchName && <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BranchStat label="Items for sale" value={String(branchItems.filter((item) => item.status === "in-stock").length)} />
        <BranchStat label="Units sold" value={String(soldUnits)} />
        <BranchStat label="Available units" value={String(availableUnits)} />
        <BranchStat label="Low stock items" value={String(lowStockCount)} tone={lowStockCount > 0 ? "text-amber" : undefined} />
      </div>}

      {!items || !categories ? (
        <LoadingPanels count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" />}
          title={items.length === 0 ? "No items yet" : "Nothing matches that filter"}
          body={
            items.length === 0
              ? "Add your first item and its quantity, location and value in Ghana cedis."
              : "Try a different search term, category or status."
          }
          action={
            items.length === 0 ? (
              <PrimaryButton
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add an item
              </PrimaryButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visibleItems.map((item, i) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              return (
                <motion.button
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: Math.min(i, 10) * 0.04, duration: 0.32 }}
                  onClick={() => setDetail(item)}
                  className="glass card3d rounded-2xl p-4 text-left"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: accentVar(cat?.accent ?? "a") }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-strong">{item.name}</p>
                      <p className="label-mono mt-0.5 truncate">
                        {cat?.name ?? "—"} · {item.location || "No location"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-lg bg-panel/70 px-2 py-0.5 text-[10px] font-medium text-fog">{statusLabel[item.status]}</span>
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${isLow(item) ? "bg-amber/15 text-amber" : "bg-aurora-a/10 text-aurora-a"}`}>
                        {isLow(item) ? "LOW STOCK" : "ABOVE ALERT"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="num text-xl font-semibold text-strong">{item.quantity}</p>
                      <p className="label-mono mt-0.5">on hand</p>
                      <p className="label-mono mt-1">{item.soldQuantity} sold</p>
                      <p className="label-mono mt-1">Alert at {item.lowStockThreshold} units</p>
                    </div>
                    <div className="text-right">
                      <p className="num text-sm text-strong">{money(item.quantity * item.originalPrice)}</p>
                      <p className="label-mono mt-0.5">{money(item.originalPrice)} cost each</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
          {pageCount > 1 && <div className="col-span-full flex items-center justify-between border-t border-hair pt-3"><span className="label-mono">Page {page} of {pageCount}</span><span className="flex gap-2"><button type="button" aria-label="Previous items page" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-lg border border-hair text-fog disabled:opacity-40"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Next items page" disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="grid size-8 place-items-center rounded-lg border border-hair text-fog disabled:opacity-40"><ChevronRight className="size-4" /></button></span></div>}
        </div>
      )}

      <ItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        categories={categories ?? []}
        item={editing}
        defaultCategoryId={category}
        canSetThreshold={user?.role !== "staff"}
      />

      <ItemDetail
        item={live}
        categoryName={
          (categories ?? []).find((c) => c.id === live?.categoryId)?.name ?? "Uncategorised"
        }
        onClose={() => setDetail(null)}
        onEdit={() => {
          setEditing(live);
          setDetail(null);
          setFormOpen(true);
        }}
        onAdjust={() => {
          setAdjusting(live);
        }}
        onDelete={() => live && void remove(live)}
      />

      <AdjustModal item={adjusting} onClose={() => setAdjusting(null)} />
    </AppShell>
  );
}

function BranchStat({ label, value, tone = "text-strong" }: { label: string; value: string; tone?: string }) {
  return (
    <section className="glass rounded-2xl p-3 sm:p-4">
      <p className="label-mono">{label}</p>
      <p className={`num mt-2 text-xl font-semibold ${tone}`}>{value}</p>
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  dot,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-aurora-a/40 bg-aurora-a/12 text-strong"
          : "border-hair bg-panel/40 text-fog/80 hover:text-strong"
      }`}
    >
      {dot && <span className="size-2 rounded-full" style={{ backgroundColor: dot }} />}
      {label}
    </button>
  );
}

function ItemDetail({
  item,
  categoryName,
  onClose,
  onEdit,
  onAdjust,
  onDelete,
}: {
  item: Item | null;
  categoryName: string;
  onClose: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onDelete: () => void;
}) {
  const history = useItemHistory(item?.id ?? null);

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item?.name ?? ""}
      subtitle={`${categoryName} · added ${item ? shortDate(item.dateAdded) : ""}`}
      wide
    >
      {item && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Quantity" value={String(item.quantity)} />
            <Stat label="Original price" value={money(item.originalPrice)} />
            <Stat label="Sold price" value={money(item.sellingPrice)} />
            <Stat label="Status" value={statusLabel[item.status]} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Location" value={item.location || "—"} />
            <Detail label="Low-stock alert" value={`${item.lowStockThreshold} units`} />
            {Object.entries(item.custom ?? {}).map(([k, v]) => (
              <Detail key={k} label={k} value={String(v)} />
            ))}
            {item.notes && (
              <div className="sm:col-span-2">
                <Detail label="Notes" value={item.notes} />
              </div>
            )}
          </div>

          <div>
            <p className="label-mono mb-2">Stock history</p>
            {!history || history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-center text-xs text-fog/70">
                No recorded changes yet.
              </p>
            ) : (
              <ol className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-2xl border border-hair bg-panel/40 p-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-aurora-b" />
                    <div className="min-w-0">
                      <p className="text-fog">{h.message}</p>
                      <p className="label-mono mt-0.5">
                        {timeAgo(h.at)}
                        {h.reason ? ` · ${h.reason}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <GhostButton onClick={onDelete} className="!text-rose">
              <span className="flex items-center justify-center gap-1.5">
                <Trash2 className="size-4" /> Delete
              </span>
            </GhostButton>
            <GhostButton onClick={onEdit}>
              <span className="flex items-center justify-center gap-1.5">
                <Pencil className="size-4" /> Edit
              </span>
            </GhostButton>
            <PrimaryButton onClick={onAdjust}>Adjust stock</PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hair bg-panel/40 p-3">
      <p className="label-mono">{label}</p>
      <p className="num mt-1 text-sm font-semibold text-strong">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hair px-3 py-2">
      <p className="label-mono">{label}</p>
      <p className="mt-0.5 break-words text-sm text-strong">{value}</p>
    </div>
  );
}

function AdjustModal({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("");

  async function apply(sign: 1 | -1) {
    if (!item) return;
    const amount = Math.abs(Number(delta) || 0) * sign;
    if (amount === 0) return toast.error("Enter how many units changed.");
    if (!reason.trim()) return toast.error("Add a reason for this stock change.");
    try {
      await adjustStock(item.id, amount, reason.trim());
      toast.success(`${item.name}: ${amount > 0 ? "+" : ""}${amount} units`);
      setReason("");
      setDelta(1);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't adjust stock.");
    }
  }

  return (
    <Modal open={!!item} onClose={onClose} title="Adjust stock" subtitle={item?.name}>
      <div className="flex flex-col gap-4">
        <Field label="Units">
          <input
            type="number"
            min={1}
            className="field num"
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
          />
        </Field>
        <Field label="Reason (required)">
          <input
            className="field"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Sold to client, damaged in transit, restocked…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <GhostButton onClick={() => void apply(-1)} className="!text-rose">
            <span className="flex items-center justify-center gap-1.5">
              <Minus className="size-4" /> Remove
            </span>
          </GhostButton>
          <PrimaryButton onClick={() => void apply(1)}>
            <span className="flex items-center justify-center gap-1.5">
              <Plus className="size-4" /> Add
            </span>
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
