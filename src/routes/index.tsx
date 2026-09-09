import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { AlertTriangle, Boxes, Coins, Package, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, PrimaryButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { ItemForm } from "@/components/ItemForm";
import { useActivity, useCategories, useItems, isLow, stockValue, accentVar } from "@/lib/ledger";
import { compactMoney, money, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veridian Inventory — stock dashboard in Ghana cedis" },
      {
        name: "description",
        content:
          "Track categories, custom fields, stock levels and value in GH₵ — all stored privately in your own browser.",
      },
      { property: "og:title", content: "Veridian Inventory — stock dashboard in Ghana cedis" },
      {
        property: "og:description",
        content: "Custom categories, custom fields and live stock value in GH₵.",
      },
    ],
  }),
  component: Dashboard,
});

function Stat({
  label,
  value,
  hint,
  icon,
  tone,
  delay,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="glass card3d rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="label-mono">{label}</p>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone }}
        >
          {icon}
        </span>
      </div>
      <p className="num mt-3 text-2xl font-semibold text-strong sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-fog/70">{hint}</p>
    </motion.div>
  );
}

function Dashboard() {
  const items = useItems();
  const categories = useCategories();
  const activity = useActivity(8);
  const [adding, setAdding] = useState(false);

  const stats = useMemo(() => {
    const list = items ?? [];
    const low = list.filter(isLow);
    return {
      count: list.reduce((s, i) => s + i.quantity, 0),
      skus: list.length,
      value: stockValue(list),
      low,
    };
  }, [items]);

  const loading = !items || !categories;

  return (
    <AppShell
      eyebrow="Overview"
      title="Dashboard"
      actions={
        <PrimaryButton onClick={() => setAdding(true)}>
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" /> Add item
          </span>
        </PrimaryButton>
      }
    >
      {loading ? (
        <LoadingPanels />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat
              label="Units in stock"
              value={String(stats.count)}
              hint={`${stats.skus} distinct items`}
              icon={<Package className="size-4" />}
              tone="var(--aurora-a)"
              delay={0}
            />
            <Stat
              label="Stock value"
              value={compactMoney(stats.value)}
              hint={money(stats.value)}
              icon={<Coins className="size-4" />}
              tone="var(--aurora-b)"
              delay={0.06}
            />
            <Stat
              label="Categories"
              value={String(categories.length)}
              hint="Each with its own fields"
              icon={<Boxes className="size-4" />}
              tone="var(--aurora-c)"
              delay={0.12}
            />
            <Stat
              label="Low stock"
              value={String(stats.low.length)}
              hint="At or below alert level"
              icon={<AlertTriangle className="size-4" />}
              tone="var(--amber)"
              delay={0.18}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section className="glass rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-strong">Low stock</h2>
                <Link to="/items" className="text-xs text-aurora-a">
                  View all items
                </Link>
              </div>
              {stats.low.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hair px-4 py-8 text-center text-sm text-fog/70">
                  Nothing is running low. Good place to be.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.low.slice(0, 6).map((item, i) => {
                    const cat = categories.find((c) => c.id === item.categoryId);
                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i }}
                        className="flex items-center gap-3 rounded-xl border border-hair bg-panel/40 px-3 py-2.5"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: accentVar(cat?.accent ?? "a") }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-strong">{item.name}</p>
                          <p className="label-mono mt-0.5 truncate">{cat?.name ?? "—"}</p>
                        </div>
                        <span className="num shrink-0 rounded-lg bg-amber/15 px-2 py-1 text-xs text-amber">
                          {item.quantity} / {item.lowStockThreshold}
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="glass rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-strong">Recent activity</h2>
                <Link to="/activity" className="text-xs text-aurora-a">
                  Full log
                </Link>
              </div>
              {!activity || activity.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hair px-4 py-8 text-center text-sm text-fog/70">
                  Movements will appear here as you work.
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {activity.map((a, i) => (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="flex gap-3"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-aurora-b" />
                      <div className="min-w-0">
                        <p className="text-sm leading-snug text-fog">{a.message}</p>
                        <p className="label-mono mt-0.5">{timeAgo(a.at)}</p>
                      </div>
                    </motion.li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          {categories.length === 0 && (
            <EmptyState
              icon={<Boxes className="size-6" />}
              title="No categories yet"
              body="Create a category like Doors, Goats or Laptops, then give it the fields your items need."
              action={
                <Link to="/categories">
                  <PrimaryButton>Create a category</PrimaryButton>
                </Link>
              }
            />
          )}
        </div>
      )}

      <ItemForm open={adding} onClose={() => setAdding(false)} categories={categories ?? []} />
    </AppShell>
  );
}
