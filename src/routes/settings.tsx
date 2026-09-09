import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Download, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { useCategories, useItems } from "@/lib/ledger";
import { clearAll, exportSnapshot, importSnapshot, type Snapshot } from "@/lib/db";
import { money } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Backup & settings — Veridian Inventory" },
      {
        name: "description",
        content:
          "Export your inventory as JSON or CSV, restore a backup, and understand that data lives only in this browser.",
      },
      { property: "og:title", content: "Backup & settings — Veridian Inventory" },
      { property: "og:description", content: "Export, import and reset your local inventory data." },
    ],
  }),
  component: SettingsPage,
});

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function SettingsPage() {
  const items = useItems();
  const categories = useCategories();
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = new Date().toISOString().slice(0, 10);

  async function exportJson() {
    const snap = await exportSnapshot();
    download(`veridian-backup-${stamp}.json`, JSON.stringify(snap, null, 2), "application/json");
    toast.success("Backup downloaded");
  }

  function exportCsv() {
    const list = items ?? [];
    const customKeys = Array.from(new Set(list.flatMap((i) => Object.keys(i.custom ?? {}))));
    const header = [
      "Name",
      "Category",
      "Quantity",
      "Unit value (GHS)",
      "Total value (GHS)",
      "Location",
      "Status",
      "Date added",
      "Notes",
      ...customKeys,
    ];
    const rows = list.map((i) => [
      i.name,
      (categories ?? []).find((c) => c.id === i.categoryId)?.name ?? "",
      i.quantity,
      i.unitValue,
      i.quantity * i.unitValue,
      i.location,
      i.status,
      i.dateAdded.slice(0, 10),
      i.notes ?? "",
      ...customKeys.map((k) => i.custom?.[k] ?? ""),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    download(`veridian-items-${stamp}.csv`, csv, "text/csv");
    toast.success("CSV downloaded");
  }

  async function onFile(file: File) {
    try {
      const snap = JSON.parse(await file.text()) as Snapshot;
      const mode = confirm("OK = replace everything, Cancel = merge into current data")
        ? "replace"
        : "merge";
      await importSnapshot(snap, mode);
      toast.success("Backup restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That file couldn't be read.");
    }
  }

  const total = (items ?? []).reduce((s, i) => s + i.quantity * i.unitValue, 0);

  return (
    <AppShell eyebrow="Data" title="Settings">
      <div className="flex flex-col gap-4">
        <section className="glass rounded-2xl border-amber/30 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber/15 text-amber">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-strong">
                Your data lives in this browser only
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-fog/80">
                Nothing is sent anywhere. Clearing your browser storage, switching device or using a
                private window means this inventory won't be there. Download a backup regularly.
              </p>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5">
          <p className="label-mono">Currently stored</p>
          <p className="num mt-2 text-lg text-strong">
            {(categories ?? []).length} categories · {(items ?? []).length} items · {money(total)}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <PrimaryButton onClick={() => void exportJson()}>
              <span className="flex items-center justify-center gap-1.5">
                <Download className="size-4" /> Export backup (JSON)
              </span>
            </PrimaryButton>
            <GhostButton onClick={exportCsv}>
              <span className="flex items-center justify-center gap-1.5">
                <Download className="size-4" /> Export items (CSV)
              </span>
            </GhostButton>
            <GhostButton onClick={() => fileRef.current?.click()}>
              <span className="flex items-center justify-center gap-1.5">
                <Upload className="size-4" /> Restore from JSON
              </span>
            </GhostButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5">
          <p className="label-mono">Danger zone</p>
          <p className="mt-2 text-sm text-fog/80">
            Erase every category, item and log entry from this browser.
          </p>
          <GhostButton
            className="mt-3 !text-rose"
            onClick={() => {
              if (!confirm("Erase all inventory data from this browser?")) return;
              void clearAll().then(() => toast.success("All data erased"));
            }}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Trash2 className="size-4" /> Erase everything
            </span>
          </GhostButton>
        </section>
      </div>
    </AppShell>
  );
}
