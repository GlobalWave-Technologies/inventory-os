import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Download, Plus, Trash2, Upload, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { CategoryForm } from "@/components/CategoryForm";
import { useCategories, useItems } from "@/lib/ledger";
import { clearAll, exportSnapshot, importSnapshot, type Snapshot } from "@/lib/db";
import { money } from "@/lib/format";
import { Modal, Field } from "@/components/Modal";
import { changePassword, createStaff, db, deleteStaff, updateStaff, type User } from "@/lib/db";
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
  const { isAdmin, user, portalId } = useAuth();
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
      "Units sold",
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
      i.soldQuantity,
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
      <AppShell eyebrow="Account" title="Account settings">
        <PasswordManager userId={user?.id ?? ""} />
        {user?.role === "manager" && <ManagerTeamDirectory categoryId={portalId ?? ""} categoryName={categories?.find((category) => category.id === portalId)?.name ?? "Assigned branch"} />}
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Data" title="Settings">
      <div className="flex flex-col gap-4">
        <PasswordManager userId={user?.id ?? ""} />
        <StaffManager />
        <section className="glass rounded-2xl border-amber/30 bg-amber/[0.04] p-4 sm:p-5">
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

        <section className="glass rounded-2xl border-aurora-a/20 p-4 sm:p-5">
          <p className="label-mono text-aurora-a">Workspace snapshot</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-strong">Currently stored</h2>
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

        <section className="glass rounded-2xl border-rose/30 p-4 sm:p-5">
          <p className="label-mono text-rose">Danger zone</p>
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

function ManagerTeamDirectory({ categoryId, categoryName }: { categoryId: string; categoryName: string }) {
  const users = useLiveQuery(() => db().users.where("role").equals("staff").toArray(), []) ?? [];
  const staff = users.filter((member) => categoryId && member.categoryIds.includes(categoryId));
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function addStaff() {
    if (!categoryId) {
      toast.error("This manager has no branch assigned.");
      return;
    }
    if (!name.trim() || !phone.trim() || !email.trim() || !password) {
      toast.error("Complete all staff account fields.");
      return;
    }
    try {
      await createStaff({ name, phone, email, password, categoryIds: [categoryId], role: "staff" });
      toast.success("Staff account created. Share the email and temporary password with them.");
      setAddOpen(false);
      setName(""); setPhone(""); setEmail(""); setPassword("");
    } catch {
      toast.error("That email is already in use, or the temporary password is too short.");
    }
  }

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="label-mono">Branch team</p><h2 className="mt-1 break-words font-display text-lg font-semibold leading-snug text-strong">Staff assigned to {categoryName}</h2><p className="mt-1 text-sm text-fog/75">Staff accounts created here can access this branch only.</p></div><PrimaryButton className="w-full justify-center sm:w-auto" onClick={() => setAddOpen(true)}><span className="flex items-center justify-center gap-1.5"><Plus className="size-4" /> Add staff</span></PrimaryButton></div>
      {staff.length === 0 ? <p className="mt-3 text-sm text-fog/70">No staff are assigned to this branch yet.</p> : <div className="mt-4 flex flex-col gap-2">{staff.map((member) => <article key={member.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-hair bg-panel/40 px-3 py-3 sm:items-center"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-aurora-a/10 text-sm font-semibold text-aurora-a">{member.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-strong">{member.name}</p><div className="mt-1 flex min-w-0 flex-col gap-0.5 text-xs leading-4 text-fog/75 sm:flex-row sm:flex-wrap sm:gap-x-2">{member.phone && <span className="break-all">{member.phone}</span>}<span className="break-all">{member.email}</span></div></div><span className="shrink-0 label-mono">Staff</span></article>)}</div>}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add staff member" subtitle={`Assign to ${categoryName}`}>
        <div className="flex flex-col gap-4">
          <Field label="Name"><input className="field" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></Field>
          <Field label="Contact number"><input className="field" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></Field>
          <Field label="Email"><input className="field" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
          <Field label="Temporary password"><input className="field" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /><p className="mt-1 text-xs text-fog/60">Staff can change this later in Settings.</p></Field>
          <Field label="Assigned branch"><p className="field bg-panel/50">{categoryName}</p></Field>
          <div className="flex justify-end gap-2"><GhostButton onClick={() => setAddOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={() => void addStaff()}>Create staff account</PrimaryButton></div>
        </div>
      </Modal>
    </section>
  );
}

function PasswordManager({ userId }: { userId: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  async function save() {
    if (Date.now() < lockedUntil) return toast.error("Too many failed attempts. Try again in 30 seconds.");
    if (!currentPassword || !nextPassword) return toast.error("Enter your current and new password.");
    if (nextPassword.length < 8) return toast.error("Your new password must be at least 8 characters.");
    if (currentPassword === nextPassword) return toast.error("Your new password must be different.");
    if (nextPassword !== confirmPassword) return toast.error("The new passwords do not match.");
    const changed = await changePassword(userId, currentPassword, nextPassword);
    if (!changed) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= 5) {
        setLockedUntil(Date.now() + 30000);
        setFailedAttempts(0);
      }
      return toast.error("Unable to change password. Check your current password.");
    }
    setFailedAttempts(0);
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    toast.success("Password changed successfully");
    return;
  }

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <p className="label-mono">Account security</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-strong">Change password</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Current password"><input type="password" className="field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="New password"><input type="password" className="field" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><input type="password" className="field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></Field>
      </div>
      <p className="mt-3 text-xs text-fog/60">Use at least 8 characters. Five failed attempts temporarily lock this form.</p>
      <PrimaryButton className="mt-4" onClick={() => void save()}>Change password</PrimaryButton>
    </section>
  );
}

function StaffManager() {
  const categories = useCategories() ?? [];
  const users = useLiveQuery(() => db().users.orderBy("createdAt").toArray(), []) ?? [];
  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "manager">("staff");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setPhone(editing?.phone ?? "");
    setPassword("");
    setRole(editing?.role === "manager" ? "manager" : "staff");
    setCategoryIds(editing?.categoryIds?.slice(0, 1) ?? []);
  }, [open, editing]);

  async function save() {
    if (!name.trim() || !email.trim()) return toast.error("Enter a name and email address.");
    if (role === "manager" && !phone.trim()) return toast.error("Enter the manager's contact number.");
    if (!editing && !password) return toast.error("Set a temporary password for this staff account.");
    try {
      if (editing) {
        await updateStaff(editing.id, { name, email, phone, categoryIds, ...(password ? { password } : {}) });
        toast.success("Staff access updated");
      } else {
        await createStaff({ name, email, phone, password, categoryIds, role });
        toast.success(`${role === "manager" ? "Manager" : "Staff"} account created`);
      }
      setOpen(false);
      return;
    } catch {
      toast.error("That email address is already in use.");
      return;
    }
  }

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="label-mono">Access control</p><h2 className="mt-1 font-display text-lg font-semibold text-strong">Branches, managers, and team access</h2><p className="mt-1 text-sm text-fog/80">Create branches, add manager accounts, and assign each team member to one branch.</p></div>
        <div className="flex flex-wrap gap-2"><GhostButton onClick={() => setBranchFormOpen(true)}><span className="flex items-center gap-1.5"><Plus className="size-4" /> Create branch</span></GhostButton><PrimaryButton onClick={() => { setEditing(null); setOpen(true); }}><span className="flex items-center gap-1.5"><Plus className="size-4" /> Add team member</span></PrimaryButton></div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {users.map((user) => (
          <div key={user.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-hair bg-panel/40 px-3 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3 sm:flex-1">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-aurora-a/15 text-aurora-a"><Users className="size-4" /></span>
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-strong">{user.name} <span className="label-mono ml-1">{user.role}</span></p><p className="mt-1 break-all text-xs text-fog/75">{user.email}</p><p className="break-words text-xs text-fog/75">{user.phone ? `${user.phone} · ` : ""}{user.role === "admin" ? "All branches" : `Branch: ${categories.find((category) => category.id === user.categoryIds[0])?.name ?? "Not assigned"}`}</p></div>
            </div>
            {user.role !== "admin" && <div className="flex w-full gap-2 sm:w-auto"><button onClick={() => { setEditing(user); setOpen(true); }} className="flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs text-fog hover:text-strong sm:flex-none">Transfer / edit</button><button onClick={() => { if (confirm(`Remove ${user.name}'s ${user.role} account?`)) void deleteStaff(user.id).then(() => toast.success(`${user.role === "manager" ? "Manager" : "Staff"} account removed`)); }} className="flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs text-rose sm:flex-none">Remove</button></div>}
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Transfer or edit ${editing.role}` : "Add team member"} subtitle="Assign one branch to each team member">
        <div className="flex flex-col gap-4">
          <Field label="Role"><select className="field" value={role} onChange={(event) => setRole(event.target.value as "staff" | "manager")} disabled={!!editing}><option value="staff">Staff</option><option value="manager">Manager</option></select></Field>
          <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "manager" ? "Manager name" : "Staff member name"} /></Field>
          <Field label={`Contact number${role === "manager" ? " (required)" : ""}`}><input type="tel" autoComplete="tel" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233 ..." /></Field>
          <Field label="Email"><input type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
          <Field label={editing ? "Temporary password (leave blank to keep current)" : "Temporary password"}><input type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label={editing ? "Transfer to branch" : "Assigned branch"}>{categories.length === 0 ? <p className="text-sm text-fog/70">Create a branch first, then assign access here.</p> : <select className="field" value={categoryIds[0] ?? ""} onChange={(event) => setCategoryIds(event.target.value ? [event.target.value] : [])}><option value="">No branch assigned</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>}</Field>
          <div className="flex justify-end gap-2"><GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={() => void save()}>{editing ? "Save access" : `Create ${role} account`}</PrimaryButton></div>
        </div>
      </Modal>
      <CategoryForm open={branchFormOpen} onClose={() => setBranchFormOpen(false)} entityName="branch" />
    </section>
  );
}
