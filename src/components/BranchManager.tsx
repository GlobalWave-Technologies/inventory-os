import { Building2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GhostButton, PrimaryButton } from "@/components/AppShell";
import { Field, Modal } from "@/components/Modal";
import { ApiError } from "@/lib/api";
import { useSingleFlight } from "@/lib/useSingleFlight";
import {
  BRANCH_TYPES,
  useBranches,
  useCreateBranch,
  useUpdateBranch,
  type BranchRecord,
  type BranchType,
} from "@/lib/branches";

const typeLabel = (type: BranchType) =>
  BRANCH_TYPES.find((entry) => entry.value === type)?.label ?? type;

const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** Admin-only card to create, rename, retype, archive and restore branches. */
export function BranchManager() {
  const { data, isLoading, isError } = useBranches(true);
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const { run, pending } = useSingleFlight();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRecord | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<BranchType>("store");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setType(editing?.type ?? "store");
  }, [open, editing]);

  const saving = createBranch.isPending || updateBranch.isPending || pending;
  const active = (data ?? []).filter((branch) => branch.isActive);
  const archived = (data ?? []).filter((branch) => !branch.isActive);

  async function saveNow() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a branch name.");
      return;
    }
    try {
      if (editing) {
        await updateBranch.mutateAsync({ id: editing.id, name: trimmed, type });
        toast.success("Branch updated");
      } else {
        await createBranch.mutateAsync({ name: trimmed, type });
        toast.success("Branch created");
      }
      setOpen(false);
    } catch (error) {
      toast.error(errorText(error, "Could not save the branch."));
    }
  }

  async function setActiveNow(branch: BranchRecord, isActive: boolean) {
    if (
      !isActive &&
      !confirm(`Archive ${branch.name}? Staff and managers will lose access to it.`)
    )
      return;
    try {
      const result = await updateBranch.mutateAsync({ id: branch.id, isActive });
      toast.success(
        isActive
          ? `${branch.name} restored`
          : `${branch.name} archived · ${result.usersUnassigned} user(s) unassigned`,
      );
    } catch (error) {
      // The server explains what is still open, for example "Branch still has: 2 open transfer(s)".
      toast.error(errorText(error, "Could not change the branch."));
    }
  }

  // Extra taps while one save is running are ignored.
  const save = () => run(saveNow);
  const setActive = (branch: BranchRecord, isActive: boolean) =>
    run(() => setActiveNow(branch, isActive));

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-mono">Locations</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-strong">Branches</h2>
          <p className="mt-1 text-sm text-fog/80">
            Stock, transfers, sales and counts are tracked per branch.
          </p>
        </div>
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" /> Create branch
          </span>
        </PrimaryButton>
      </div>

      {isLoading && <p className="mt-4 text-sm text-fog/70">Loading branches…</p>}
      {isError && (
        <p className="mt-4 rounded-xl border border-amber/30 p-3 text-sm text-amber">
          Could not load branches. Check that the API is running.
        </p>
      )}
      {!isLoading && !isError && active.length === 0 && (
        <p className="mt-4 text-sm text-fog/70">No branches yet. Create your first one.</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {active.map((branch) => (
          <BranchRow
            key={branch.id}
            branch={branch}
            busy={saving}
            onEdit={() => {
              setEditing(branch);
              setOpen(true);
            }}
            onToggle={() => void setActive(branch, false)}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <div className="mt-5">
          <p className="label-mono">Archived</p>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map((branch) => (
              <BranchRow
                key={branch.id}
                branch={branch}
                busy={saving}
                onToggle={() => void setActive(branch, true)}
              />
            ))}
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit branch" : "Create branch"}
        subtitle="A place that holds stock"
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <input
              className="field"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main store"
            />
          </Field>
          <Field label="Type">
            <select
              className="field"
              value={type}
              onChange={(event) => setType(event.target.value as BranchType)}
            >
              {BRANCH_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create branch"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function BranchRow({
  branch,
  busy,
  onEdit,
  onToggle,
}: {
  branch: BranchRecord;
  busy: boolean;
  onEdit?: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-hair bg-panel/40 px-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3 sm:flex-1">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-aurora-a/15 text-aurora-a">
          <Building2 className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-strong">{branch.name}</p>
          <p className="label-mono">{typeLabel(branch.type)}</p>
        </div>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        {onEdit && (
          <button
            onClick={onEdit}
            disabled={busy}
            className="flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs text-fog hover:text-strong sm:flex-none"
          >
            Edit
          </button>
        )}
        <button
          onClick={onToggle}
          disabled={busy}
          className={`flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs sm:flex-none ${
            branch.isActive ? "text-rose" : "text-fog hover:text-strong"
          }`}
        >
          {branch.isActive ? "Archive" : "Restore"}
        </button>
      </div>
    </div>
  );
}
