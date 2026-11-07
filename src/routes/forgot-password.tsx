import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot password — StockLine Inventory" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const clean = email.trim();
    if (clean.length < 5 || clean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/auth/forgot-password", { email: email.trim() });
      // The same answer for every address, so nobody can use this page to find out who has an account.
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error, "Could not send that. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">StockLine account</p>
        <h1 className="mt-3 text-2xl font-semibold">Forgot your password?</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted-foreground">
            If an account exists for that email, we have sent a link to choose a new password. It works for one hour
            and can be used once. Check your spam folder too. If nothing arrives, ask your admin for a reset link.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your work email and we will send you a link to choose a new password.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium">
                Work email
                <input
                  className="field mt-1"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={254}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
              <button
                className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <Link to="/" className="mt-5 inline-block text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
