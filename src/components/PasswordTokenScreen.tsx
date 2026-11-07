import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { apiPost, apiRequest, clearTokens } from "@/lib/api";

export function PasswordTokenScreen({
  token,
  mode,
}: {
  token: string;
  mode: "activate" | "reset";
}) {
  const { activateAccount, resetPassword } = useAuth();
  // Keep the token in memory and take it out of the address bar, so it does not stay in
  // the browser history or get copied along when someone shares a screenshot or the URL.
  const [keptToken] = useState(token);
  useEffect(() => {
    if (window.location.search.includes("token=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const isActivation = mode === "activate";

  // Ask the server whether the link is still good, so an old link says so immediately.
  // If the check itself can't be made (for example no signal), the form is shown and the server still decides on submit.
  const [linkState, setLinkState] = useState<"checking" | "ok" | "bad">("checking");
  useEffect(() => {
    if (!keptToken) {
      setLinkState("bad");
      return;
    }
    let cancelled = false;
    apiPost<{ valid: boolean }>("/auth/link-status", { token: keptToken, mode: isActivation ? "activate" : "reset" })
      .then((r) => !cancelled && setLinkState(r.valid ? "ok" : "bad"))
      .catch(() => !cancelled && setLinkState("ok"));
    return () => {
      cancelled = true;
    };
  }, [keptToken, isActivation]);

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
    if (!keptToken) {
      toast.error("This link is missing its token.");
      return;
    }

    setSaving(true);
    try {
      if (isActivation) await activateAccount(keptToken, password);
      else await resetPassword(keptToken, password);
      toast.success(
        isActivation
          ? "Account activated. You can sign in now."
          : "Password reset. You can sign in now.",
      );
      // Whoever opens this link must land on the sign-in screen, never in a session left on this browser.
      try {
        await apiRequest("/auth/logout", { method: "POST" });
      } catch {
        /* the sign-in screen still asks for the new password */
      }
      clearTokens();
      window.location.assign("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This link could not be used.");
    } finally {
      setSaving(false);
    }
  }

  if (linkState !== "ok") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">StockLine account</p>
          {linkState === "checking" ? (
            <p className="mt-3 text-sm text-muted-foreground">Checking your link…</p>
          ) : (
            <>
              <h1 className="mt-3 text-2xl font-semibold">This link has expired</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {isActivation
                  ? "It was already used, or it is too old. Ask your administrator to send you a new activation link."
                  : "It was already used, or it is too old. Go to the sign-in page and choose “Forgot password” for a new one."}
              </p>
              <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary">
                Back to sign in
              </Link>
            </>
          )}
        </section>
      </main>
    );
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
              maxLength={128}
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
              maxLength={128}
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
