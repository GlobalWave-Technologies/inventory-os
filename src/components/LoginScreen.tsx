import { ArrowLeft, KeyRound, LockKeyhole, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

type AuthMode = "login" | "signup" | "forgot";

export function LoginScreen() {
  const { login, signup, forgotPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (mode === "login") {
        const ok = await login(email, password);
        if (!ok) toast.error("Incorrect email or password.");
        return;
      }

      if (password.length < 6) {
        toast.error("Use a password with at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("The passwords do not match.");
        return;
      }

      if (mode === "signup") {
        const ok = await signup(name, email, password);
        if (!ok) toast.error("An account with this email already exists.");
      } else {
        const ok = await forgotPassword(email, password);
        if (ok) {
          toast.success("Password updated. You can sign in now.");
          setMode("login");
          setPassword("");
          setConfirmPassword("");
        } else {
          toast.error("No account was found for that email.");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const isLogin = mode === "login";
  const isSignup = mode === "signup";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#102225] text-fog">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/login-background.jpg'), url('https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=2200&q=85')",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,24,27,0.88),rgba(8,24,27,0.62)_48%,rgba(8,24,27,0.3))]" aria-hidden="true" />
      <div className="relative grid min-h-screen place-items-center px-4 py-8 lg:place-items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)] lg:gap-10 lg:px-12">
        <section className="hidden flex-col justify-end pb-10 text-white lg:flex">
          <p className="label-mono text-white/70">Inventory control, clearly visible</p>
          <h2 className="mt-3 max-w-xl font-display text-5xl leading-[0.95]">Every unit accounted for.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/75">StockLine gives your team a calm, reliable view of what is moving through the operation.</p>
        </section>
        <form onSubmit={submit} className="glass relative w-full max-w-md self-center rounded-3xl p-6 sm:p-8 lg:justify-self-end">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-aurora-a via-aurora-b to-aurora-c text-background"><LockKeyhole className="size-5" /></span>
          <div><p className="font-display text-2xl font-semibold text-strong">StockLine</p><p className="label-mono mt-0.5">Inventory workspace</p></div>
        </div>
        <div className="flex items-center gap-2">
          {mode !== "login" && <button type="button" onClick={() => setMode("login")} className="text-fog/70 hover:text-strong"><ArrowLeft className="size-4" /></button>}
          <div>
            <h1 className="font-display text-xl font-semibold text-strong">{isLogin ? "Sign in" : isSignup ? "Create your account" : "Reset your password"}</h1>
            <p className="mt-1 text-sm text-fog/80">{isLogin ? "Use your StockLine account to continue." : isSignup ? "Start managing your inventory in a private workspace." : "Set a new password for your local account."}</p>
          </div>
        </div>
        {isSignup && <label className="mt-6 block text-xs text-fog">Name<input required autoComplete="name" className="field mt-1.5" value={name} onChange={(e) => setName(e.target.value)} /></label>}
        <label className={`${isSignup ? "mt-4" : "mt-6"} block text-xs text-fog`}>Email<input required type="email" autoComplete="email" className="field mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {!isLogin && <p className="mt-2 text-xs text-fog/60">Password changes are stored only in this browser.</p>}
        {isLogin && <label className="mt-4 block text-xs text-fog">Password<input required type="password" autoComplete="current-password" className="field mt-1.5" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
        {!isLogin && <>
          <label className="mt-4 block text-xs text-fog">New password<input required minLength={6} type="password" autoComplete="new-password" className="field mt-1.5" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label className="mt-4 block text-xs text-fog">Confirm password<input required minLength={6} type="password" autoComplete="new-password" className="field mt-1.5" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
        </>}
        <button disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aurora-a to-aurora-b px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-60">{isSignup ? <UserPlus className="size-4" /> : !isLogin ? <KeyRound className="size-4" /> : null}{saving ? "Working..." : isLogin ? "Sign in" : isSignup ? "Create account" : "Update password"}</button>
        {isLogin && <div className="mt-5 flex justify-between text-xs"><button type="button" onClick={() => setMode("forgot")} className="text-aurora-a hover:underline">Forgot password?</button><button type="button" onClick={() => setMode("signup")} className="text-aurora-a hover:underline">Create account</button></div>}
        {isLogin && <p className="mt-5 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs leading-relaxed text-fog/85">First-time admin: <strong className="text-strong">admin@veridian.local</strong> / <strong className="text-strong">admin123</strong>.</p>}
        </form>
      </div>
    </main>
  );
}
