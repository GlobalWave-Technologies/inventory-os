import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PrimaryButton } from "@/components/AppShell";
import { BranchManager } from "@/components/BranchManager";
import { Field } from "@/components/Modal";
import { UsersManager } from "@/components/UsersManager";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { useSingleFlight } from "@/lib/useSingleFlight";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — StockLine Inventory" },
      {
        name: "description",
        content: "Manage your password, branches and team.",
      },
      { property: "og:title", content: "Settings — StockLine Inventory" },
      {
        property: "og:description",
        content: "Account security, branches and team access.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, managerSectionEnabled, setManagerSectionEnabled } = useAuth();

  if (!isAdmin) {
    return (
      <AppShell eyebrow="Account" title="Account settings">
        <PasswordManager />
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Admin" title="Settings">
      <div className="flex flex-col gap-4">
        <PasswordManager />
        <ManagerSectionControl
          enabled={managerSectionEnabled}
          onChange={setManagerSectionEnabled}
        />
        <BranchManager />
        <UsersManager />
      </div>
    </AppShell>
  );
}

function ManagerSectionControl({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => Promise<void>;
}) {
  const { run, pending } = useSingleFlight();

  const update = (next: boolean) =>
    run(async () => {
      try {
        await onChange(next);
        toast.success(next ? "Manager access activated" : "Manager access deactivated");
      } catch (error) {
        toast.error(errorMessage(error, "Manager access could not be updated."));
      }
    });

  return (
    <section className="glass rounded-2xl border-aurora-a/20 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="label-mono text-aurora-a">Reporting structure</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-strong">Manager section</h2>
          <p className="mt-1 max-w-2xl text-sm text-fog/75">
            {enabled
              ? "Managers can approve requests for their branches and submit sales summaries."
              : "Off: manager accounts are kept but work like staff, and admins do all the approvals."}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={(checked) => void update(checked)}
          aria-label="Activate manager section"
        />
      </div>
      <p className="label-mono mt-3">{enabled ? "Active" : "Inactive"}</p>
    </section>
  );
}

function PasswordManager() {
  const { changePassword } = useAuth();
  const { run, pending } = useSingleFlight();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function saveNow() {
    if (!currentPassword || !nextPassword) {
      toast.error("Enter your current and new password.");
      return;
    }
    if (nextPassword.length < 12) {
      toast.error("Your new password must be at least 12 characters.");
      return;
    }
    if (currentPassword === nextPassword) {
      toast.error("Your new password must be different.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      toast.error("The new passwords do not match.");
      return;
    }
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      toast.success("Password changed. You are signed in with your new password.");
    } catch (error) {
      toast.error(errorMessage(error, "Unable to change password."));
    }
  }

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <p className="label-mono">Account security</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-strong">Change password</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Current password">
          <input
            type="password"
            className="field"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            className="field"
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            className="field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <p className="mt-3 text-xs text-fog/60">Use at least 12 characters.</p>
      <PrimaryButton className="mt-4" onClick={() => void run(saveNow)} disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </PrimaryButton>
    </section>
  );
}
