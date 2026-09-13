import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Download, Plus, Trash2, Upload, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { useCategories, useItems } from "@/lib/ledger";
import { clearAll, exportSnapshot, importSnapshot, type Snapshot } from "@/lib/db";
import { money } from "@/lib/format";
import { Modal, Field } from "@/components/Modal";
import { createStaff, db, deleteStaff, updateStaff, type User } from "@/lib/db";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Backup & settings — StockLine Inventory" },
      {
        name: "description",
        content:
          "Export your inventory as JSON or CSV, restore a backup, and understand that data lives only in this browser.",
      },
      { property: "og:title", content: "Backup & settings — StockLine Inventory" },
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
  const { isAdmin } = useAuth();
  const items = useItems();
  const categories = useCategories();
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = new Date().toISOString().slice(0, 10);

  async function exportJson() {
    const snap = await exportSnapshot();
    download(`stockline-backup-${stamp}.json`, JSON.stringify(snap, null, 2), "application/json");
    toast.success("Backup downloaded");
  }

  function exportCsv() {
    const list = items ?? [];
    const customKeys = Array.from(new Set(list.flatMap((i) => Object.keys(i.custom ?? {}))));
    const header = [
      "Name",
      "Category",
      "Quantity",
      "Original price (GHS)",
      "Sold price (GHS)",
      "Profit per unit (GHS)",
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
      i.originalPrice,
      i.sellingPrice,
      i.sellingPrice - i.originalPrice,
      i.location,
      i.status,
      i.dateAdded.slice(0, 10),
      i.notes ?? "",
      ...customKeys.map((k) => i.custom?.[k] ?? ""),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    download(`stockline-items-${stamp}.csv`, csv, "text/csv");
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

  const total = (items ?? []).reduce((s, i) => s + i.quantity * i.originalPrice, 0);

  if (!isAdmin) {
    return (
      <AppShell eyebrow="Access" title="Admin only">
        <section className="glass rounded-2xl p-5 text-sm text-fog/80">
          This area is reserved for the administrator. Your assigned inventory categories are available from Items.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Data" title="Settings">
      <div className="flex flex-col gap-4">
        <StaffManager />
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

function StaffManager() {
  const categories = useCategories() ?? [];
  const users = useLiveQuery(() => db().users.orderBy("createdAt").toArray(), []) ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setPassword("");
    setCategoryIds(editing?.categoryIds ?? []);
  }, [open, editing]);

  async function save() {
    if (!name.trim() || !email.trim()) return toast.error("Enter a name and email address.");
    if (!editing && !password) return toast.error("Set a temporary password for this staff account.");
    try {
      if (editing) {
        await updateStaff(editing.id, { name, email, categoryIds, ...(password ? { password } : {}) });
        toast.success("Staff access updated");
      } else {
        await createStaff({ name, email, password, categoryIds });
        toast.success("Staff account created");
      }
      setOpen(false);
    } catch {
      toast.error("That email address is already in use.");
    }
  }

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="label-mono">Access control</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Staff and category access</h2><p className="mt-1 text-sm text-fog/80">Staff see and work only in the categories you assign to them.</p></div>
        <PrimaryButton onClick={() => { setEditing(null); setOpen(true); }}><span className="flex items-center gap-1.5"><Plus className="size-4" /> Add staff</span></PrimaryButton>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {users.map((user) => (
          <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-hair bg-panel/40 px-3 py-3">
            <span className="grid size-8 place-items-center rounded-lg bg-aurora-a/15 text-aurora-a"><Users className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-strong">{user.name} <span className="label-mono ml-1">{user.role}</span></p><p className="truncate text-xs text-fog/75">{user.email} · {user.role === "admin" ? "All categories" : `${user.categoryIds.length} assigned category${user.categoryIds.length === 1 ? "" : "ies"}`}</p></div>
            {user.role === "staff" && <><button onClick={() => { setEditing(user); setOpen(true); }} className="rounded-lg border border-hair px-2.5 py-1.5 text-xs text-fog hover:text-strong">Edit access</button><button onClick={() => { if (confirm(`Remove ${user.name}'s staff account?`)) void deleteStaff(user.id).then(() => toast.success("Staff account removed")); }} className="rounded-lg border border-hair px-2.5 py-1.5 text-xs text-rose">Remove</button></>}
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit staff access" : "Add staff member"} subtitle="Assign the inventory categories this person can access">
        <div className="flex flex-col gap-4">
          <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Staff member name" /></Field>
          <Field label="Email"><input type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
          <Field label={editing ? "New password (leave blank to keep current)" : "Temporary password"}><input type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <div><p className="label-mono mb-2">Allowed categories</p>{categories.length === 0 ? <p className="text-sm text-fog/70">Create categories first, then assign access here.</p> : <div className="grid gap-2 sm:grid-cols-2">{categories.map((category) => <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-hair px-3 py-2 text-sm text-strong"><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => setCategoryIds((ids) => ids.includes(category.id) ? ids.filter((id) => id !== category.id) : [...ids, category.id])} />{category.name}</label>)}</div>}</div>
          <div className="flex justify-end gap-2"><GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={() => void save()}>{editing ? "Save access" : "Create staff account"}</PrimaryButton></div>
        </div>
      </Modal>
    </section>
  );
}
