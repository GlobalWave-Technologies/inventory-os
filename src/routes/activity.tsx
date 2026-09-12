import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { History } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { useAccessibleActivity } from "@/lib/ledger";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Movement log — StockLine Inventory" },
      {
        name: "description",
        content:
          "A running record of every stock adjustment, edit and deletion, with the reason and the time it happened.",
      },
      { property: "og:title", content: "Movement log — StockLine Inventory" },
      { property: "og:description", content: "Every stock change, when it happened and why." },
    ],
  }),
  component: ActivityPage,
});

export function toneFor(kind: string) {
  if (kind === "stock-adjusted") return "var(--aurora-b)";
  if (kind.endsWith("deleted")) return "var(--rose)";
  if (kind === "data-imported") return "var(--amber)";
  return "var(--aurora-a)";
}

function ActivityPage() {
  const activity = useAccessibleActivity(300);

  return (
    <AppShell eyebrow="History" title="Movement log">
      {!activity ? (
        <LoadingPanels count={3} />
      ) : activity.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" />}
          title="Nothing recorded yet"
          body="Add items or adjust stock and every change will be logged here automatically."
        />
      ) : (
        <ol className="glass flex flex-col rounded-2xl p-2 sm:p-3">
          {activity.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03 }}
              className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-panel/50"
            >
              <span
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: toneFor(a.kind) }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-strong">{a.message}</p>
                <p className="label-mono mt-1">
                  {timeAgo(a.at)}
                  {a.reason ? ` · ${a.reason}` : ""}
                </p>
              </div>
              {typeof a.delta === "number" && a.delta !== 0 && (
                <span
                  className={`num shrink-0 rounded-lg px-2 py-1 text-xs ${
                    a.delta > 0 ? "bg-aurora-a/15 text-aurora-a" : "bg-rose/15 text-rose"
                  }`}
                >
                  {a.delta > 0 ? "+" : ""}
                  {a.delta}
                </span>
              )}
            </motion.li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}
