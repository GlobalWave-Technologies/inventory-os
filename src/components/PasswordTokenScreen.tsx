import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export function PasswordTokenScreen({
  token,
  mode,
}: {
  token: string;
  mode: "activate" | "reset";
}) {
  const { activateAccount, resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const isActivation = mode === "activate";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 12) {
      toast.error("Use a password with at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("The passwords do not match.");
      return;
    }
    if (!token) {
      toast.error("This link is missing its token.");
      return;
    }

    setSaving(true);
    try {
      if (isActivation) await activateAccount(token, password);
      else await resetPassword(token, password);
      toast.success(
        isActivation
          ? "Account activated. You can sign in now."
          : "Password reset. You can sign in now.",
      );
      window.location.assign("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This link could not be used.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          StockLine account
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          {isActivation ? "Activate your account" : "Choose a new password"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set a password with at least 12 characters.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            New password
            <input
              className="field mt-1"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm password
            <input
              className="field mt-1"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          <button
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : isActivation ? "Activate account" : "Reset password"}
          </button>
        </form>
        <Link to="/" className="mt-5 inline-block text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
