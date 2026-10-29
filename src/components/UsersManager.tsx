import { Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GhostButton, PrimaryButton } from "@/components/AppShell";
import { Field, Modal } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { useBranches } from "@/lib/branches";
import { errorMessage } from "@/lib/errors";
import {
  requestActivationLink,
  requestResetLink,
  useCreateUser,
  useSetUserActive,
  useTeamUsers,
  useUpdateUser,
  type LinkResult,
  type RoleName,
  type TeamUser,
} from "@/lib/users";
import { useSingleFlight } from "@/lib/useSingleFlight";

const ROLE_LABEL: Record<RoleName, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

type FormRole = "admin" | "manager" | "staff";

type ShownLink = { title: string; url: string; note: string };

/** Admin-only card: add people, edit them, switch them off, and hand out activation or reset links. */
export function UsersManager() {
  const { user: me, managerSectionEnabled } = useAuth();
  const usersQuery = useTeamUsers();
  const branchesQuery = useBranches(true);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setActive = useSetUserActive();
  const { run, pending } = useSingleFlight();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<FormRole>("staff");
  const [locationIds, setLocationIds] = useState<number[]>([]);
  const [shownLink, setShownLink] = useState<ShownLink | null>(null);

  const isSuperAdmin = me?.isSuperAdmin ?? false;
  const users = usersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const allBranches = branchesQuery.data ?? [];
  const activeBranches = allBranches.filter((branch) => branch.isActive);
  const branchName = (id: number) => allBranches.find((branch) => branch.id === id)?.name ?? `#${id}`;
  const busy = pending || createUser.isPending || updateUser.isPending || setActive.isPending;

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setPhone(editing?.phone ?? "");
    setRole(editing && editing.role !== "super_admin" ? editing.role : "staff");
    setLocationIds(editing?.locationIds ?? []);
  }, [open, editing]);

  // The server enforces all of this too; hiding the buttons just saves a failed tap.
  const canManage = (target: TeamUser) =>
    target.role !== "super_admin" &&
    String(target.id) !== me?.id &&
    (isSuperAdmin || target.role !== "admin");

  const roleOptions: FormRole[] = [
    "staff",
    ...(managerSectionEnabled || editing?.role === "manager" ? (["manager"] as const) : []),
    ...(isSuperAdmin ? (["admin"] as const) : []),
  ];

  const toggleBranch = (id: number) =>
    setLocationIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  function showLink(result: LinkResult, who: string, kind: "activation" | "reset") {
    if (result.emailSent) {
      toast.success(`Email sent to ${who}.`);
      return;
    }
    const token = kind === "activation" ? result.activationToken : result.resetToken;
    if (!token) {
      toast.error("The server did not return a link. Try again.");
      return;
    }
    const path = kind === "activation" ? "activate" : "reset-password";
    const expiry =
      kind === "activation"
        ? `${result.expiresInHours ?? 48} hours`
        : `${result.expiresInMinutes ?? 60} minutes`;
    setShownLink({
      title: kind === "activation" ? `Activation link for ${who}` : `Password reset link for ${who}`,
      url: `${window.location.origin}/${path}?token=${encodeURIComponent(token)}`,
      note: `Valid for ${expiry}. It is shown only once, so copy it now and send it to ${who}.`,
    });
  }

  async function saveNow() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Enter a name.");
      return;
    }
    if (role !== "admin" && locationIds.length === 0) {
      toast.error("Choose at least one branch.");
      return;
    }
    try {
      if (editing) {
        await updateUser.mutateAsync({
          id: editing.id,
          name: trimmedName,
          phone: phone.trim(),
          ...(role !== editing.role ? { role } : {}),
          ...(role !== "admin" ? { locationIds } : {}),
        });
        toast.success(`${trimmedName} updated`);
        setOpen(false);
        return;
      }
      const trimmedEmail = email.trim();
      if (!trimmedEmail.includes("@")) {
        toast.error("Enter a valid email address.");
        return;
      }
      const result = await createUser.mutateAsync({
        email: trimmedEmail,
        name: trimmedName,
        role,
        locationIds: role === "admin" ? [] : locationIds,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      setOpen(false);
      showLink(result, trimmedName, "activation");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save this person."));
    }
  }
  const save = () => run(saveNow);

  async function toggleActiveNow(target: TeamUser) {
    const next = !target.isActive;
    if (!next && !confirm(`Deactivate ${target.name}? They will be signed out and cannot sign in.`)) return;
    try {
      await setActive.mutateAsync({ id: target.id, active: next });
      toast.success(next ? `${target.name} reactivated` : `${target.name} deactivated`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not change this account."));
    }
  }
  const toggleActive = (target: TeamUser) => run(() => toggleActiveNow(target));

  async function newLinkNow(target: TeamUser) {
    try {
      if (target.pending) {
        showLink(await requestActivationLink(target.id), target.name, "activation");
      } else {
        if (!confirm(`Make a password reset link for ${target.name}? Any older link stops working.`)) return;
        showLink(await requestResetLink(target.id), target.name, "reset");
      }
    } catch (error) {
      toast.error(errorMessage(error, "Could not make a link."));
    }
  }
  const newLink = (target: TeamUser) => run(() => newLinkNow(target));

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Press and hold the link to copy it by hand.");
    }
  }

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-mono">Access control</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-strong">Team</h2>
          <p className="mt-1 text-sm text-fog/80">
            Add people, choose their branches, and give them an activation link to set a password.
          </p>
        </div>
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" /> Add team member
          </span>
        </PrimaryButton>
      </div>

      {usersQuery.isLoading && <p className="mt-4 text-sm text-fog/70">Loading team…</p>}
      {usersQuery.isError && (
        <p className="mt-4 rounded-xl border border-amber/30 p-3 text-sm text-amber">
          Could not load the team. Check that the API is running.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {users.map((member) => {
          const status = member.pending ? "Pending activation" : member.isActive ? "Active" : "Deactivated";
          const statusColour = member.pending ? "text-amber" : member.isActive ? "text-aurora-a" : "text-rose";
          const manageable = canManage(member);
          return (
            <div
              key={member.id}
              className="flex min-w-0 flex-col gap-3 rounded-xl border border-hair bg-panel/40 px-3 py-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-aurora-a/15 text-aurora-a">
                  <Users className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-strong">
                    {member.name}
                    <span className="label-mono ml-2">{ROLE_LABEL[member.role]}</span>
                    <span className={`label-mono ml-2 ${statusColour}`}>{status}</span>
                  </p>
                  <p className="mt-1 break-all text-xs text-fog/75">{member.email}</p>
                  <p className="break-words text-xs text-fog/75">
                    {member.phone ? `${member.phone} · ` : ""}
                    {member.role === "admin" || member.role === "super_admin"
                      ? "All branches"
                      : member.locationIds.length === 0
                        ? "No branch assigned"
                        : member.locationIds.map(branchName).join(", ")}
                  </p>
                </div>
              </div>
              {manageable && (
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                  <button
                    onClick={() => {
                      setEditing(member);
                      setOpen(true);
                    }}
                    disabled={busy}
                    className="flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs text-fog hover:text-strong sm:flex-none"
                  >
                    Edit
                  </button>
                  {(member.pending || member.isActive) && (
                    <button
                      onClick={() => void newLink(member)}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs text-fog hover:text-strong sm:flex-none"
                    >
                      {member.pending ? "New activation link" : "Reset password link"}
                    </button>
                  )}
                  {!member.pending && (
                    <button
                      onClick={() => void toggleActive(member)}
                      disabled={busy}
                      className={`flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs sm:flex-none ${
                        member.isActive ? "text-rose" : "text-fog hover:text-strong"
                      }`}
                    >
                      {member.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!usersQuery.isLoading && users.length === 0 && !usersQuery.isError && (
          <p className="text-sm text-fog/70">No team members yet.</p>
        )}
        {usersQuery.hasNextPage && (
          <div className="flex justify-center pt-2">
            <GhostButton onClick={() => void usersQuery.fetchNextPage()}>
              {usersQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </GhostButton>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add team member"}
        subtitle={editing ? editing.email : "They get a link to set their own password"}
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <input className="field" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </Field>
          {!editing && (
            <Field label="Email">
              <input
                type="email"
                className="field"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </Field>
          )}
          <Field label="Phone (optional)">
            <input
              type="tel"
              className="field"
              value={phone}
              maxLength={30}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 ..."
            />
          </Field>
          <Field label="Role">
            <select className="field" value={role} onChange={(e) => setRole(e.target.value as FormRole)}>
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABEL[option]}
                </option>
              ))}
            </select>
          </Field>
          {!managerSectionEnabled && (
            <p className="-mt-2 text-xs text-fog/60">
              Managers are switched off, so the Manager role is hidden. Turn it on above to use it.
            </p>
          )}
          {role === "admin" ? (
            <p className="text-sm text-fog/70">Admins can use every branch.</p>
          ) : (
            <Field label="Branches">
              {activeBranches.length === 0 ? (
                <p className="text-sm text-fog/70">Create a branch first, then assign people to it.</p>
              ) : (
                <div className="flex flex-col gap-2 rounded-2xl border border-hair bg-panel/40 p-3">
                  {activeBranches.map((branch) => (
                    <label key={branch.id} className="flex items-center gap-2 text-sm text-fog">
                      <input
                        type="checkbox"
                        checked={locationIds.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                      />
                      {branch.name}
                    </label>
                  ))}
                </div>
              )}
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create account"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={shownLink !== null}
        onClose={() => setShownLink(null)}
        title={shownLink?.title ?? ""}
        subtitle="Shown once"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog/80">{shownLink?.note}</p>
          <input
            readOnly
            className="field break-all"
            value={shownLink?.url ?? ""}
            onFocus={(e) => e.target.select()}
          />
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => void copyLink(shownLink?.url ?? "")}>Copy link</GhostButton>
            <PrimaryButton onClick={() => setShownLink(null)}>Done</PrimaryButton>
          </div>
        </div>
      </Modal>
    </section>
  );
}
