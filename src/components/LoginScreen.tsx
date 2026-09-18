import { ArrowLeft, ArrowRight, KeyRound, Mail, ShieldCheck, UserPlus, Warehouse } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/db";

type AuthMode = "login" | "signup" | "forgot";
type EntryRole = User["role"];

export function LoginScreen() {
  const { login, signup, forgotPassword } = useAuth();
  const [entry, setEntry] = useState<EntryRole | null>(null);
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
        const ok = await login(email, password, entry ?? "staff");
        if (!ok) {
          toast.error(`Incorrect ${entry === "admin" ? "admin" : "staff"} email or password.`);
          return;
        }
        return;
      }

      if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        toast.error("Use a stronger password: 12+ chars with upper/lowercase, a number, and a symbol.");
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
  const isLanding = entry === null;
  const title = isLogin ? "Welcome back" : isSignup ? "Create your workspace" : "Recover access";
  const roleLabel = entry === "admin" ? "Admin workspace" : "Staff workspace";
  const description = isLogin
    ? "Sign in to keep every item, movement, and decision in view."
    : isSignup
      ? "Set up a private StockLine account for your inventory team."
      : "Choose a new password for your local StockLine account.";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#102225] text-fog">
      <img
        src="https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1280&q=65&fm=webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,20,22,0.58),rgba(5,20,22,0.35)_45%,rgba(5,20,22,0.12))]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(77,208,170,0.1),transparent_28%),radial-gradient(circle_at_85%_85%,rgba(235,157,101,0.08),transparent_26%)]" aria-hidden="true" />
      <div className="relative min-h-screen px-4 py-5 sm:px-6 lg:px-12">
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-2 border-b border-white/15 pb-4">
          <button type="button" onClick={() => { setEntry(null); setMode("login"); }} className="flex min-w-0 items-center gap-2 text-left sm:gap-3">
            <img src="/inventory-control-logo.svg" alt="Inventory Control" className="size-12 shrink-0 rounded-lg bg-white object-contain sm:size-14" />
            <span className="min-w-0"><span className="block truncate font-display text-[25px] leading-none text-white sm:text-2xl">StockLine</span><span className="label-mono mt-1 hidden text-white/70 sm:block">Inventory workspace</span></span>
          </button>
          <nav className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <button type="button" onClick={() => { setEntry("staff"); setMode("login"); }} className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-colors sm:rounded-xl sm:px-4 sm:text-xs ${entry === "staff" ? "border-aurora-a bg-aurora-a text-background" : "border-white/40 bg-[#071d1b]/80 text-white shadow-sm backdrop-blur hover:border-aurora-a hover:bg-[#071d1b]"}`}>Staff</button>
            <button type="button" onClick={() => { setEntry("admin"); setMode("login"); }} className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-colors sm:rounded-xl sm:px-4 sm:text-xs ${entry === "admin" ? "border-aurora-a bg-aurora-a text-background" : "border-white/40 bg-[#071d1b]/80 text-white shadow-sm backdrop-blur hover:border-aurora-a hover:bg-[#071d1b]"}`}>Admin</button>
          </nav>
        </header>
        <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-7xl place-items-center lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:gap-12">
        <section className={`${isLanding ? "hidden" : "hidden lg:flex"} flex-col justify-end pb-12 text-white`}>
          <div className="mb-7 flex items-center gap-2 text-white/70">
            <span className="h-px w-8 bg-aurora-a" />
            <p className="label-mono text-white/70">Inventory control, clearly visible</p>
          </div>
          <h2 className="max-w-xl font-display text-6xl font-semibold leading-[0.9] tracking-tight">Track, Manage, and<br /><span className="text-aurora-a">Grow with Ease.</span></h2>
          <p className="mt-6 max-w-md text-sm leading-6 text-white/70">StockLine gives your team a calm, reliable view of what is moving through the operation.</p>
          <div className="mt-8 flex gap-3">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80">Live stock view</span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80">Private by default</span>
          </div>
        </section>
        {isLanding ? (
          <section className="w-full max-w-lg self-center text-center lg:justify-self-end lg:text-left">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 text-aurora-a shadow-2xl backdrop-blur-sm lg:mx-0"><Warehouse className="size-7" /></div>
            <p className="label-mono mt-6 text-base text-white/65">One clear view of your operation</p>
            <h1 className="mt-3 font-display text-5xl font-semibold leading-[0.92] text-white sm:text-6xl lg:text-[4.3rem]">Track, Manage, and<br /><span className="text-aurora-a">Grow with Ease.</span></h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/80 sm:text-lg">Track, manage, and grow with ease from one clear, reliable workspace.</p>
            <p className="mt-8 max-w-md text-base leading-7 text-white/70 sm:text-lg">Choose Staff or Admin above to enter your workspace securely.</p>
          </section>
        ) : <form onSubmit={submit} className="relative w-full max-w-[380px] self-center overflow-hidden rounded-[28px] border border-white/30 bg-[#071d1b]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-4 lg:justify-self-end">
        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Back to login options" onClick={() => { setEntry(null); setMode("login"); }} className="grid size-9 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition-colors hover:border-aurora-a hover:bg-aurora-a/15 hover:text-white">
              <img src="/back-arrow.svg" alt="" className="size-5" />
            </button>
            <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-aurora-a" /><span className="label-mono text-white/60">{entry === "admin" ? "Admin" : "Staff"}</span></div>
          </div>
          <div className="mt-7"><p className="label-mono text-aurora-a">{roleLabel}</p><h1 className="mt-2 font-display text-4xl font-semibold leading-[0.95] text-white">{title}</h1><p className="mt-3 max-w-sm text-[13px] leading-5 text-white/70">{description}</p></div>
          {isLogin && <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/15 p-1">
            <button type="button" onClick={() => { setEntry("staff"); setMode("login"); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${entry === "staff" ? "bg-aurora-a text-background" : "text-white/60 hover:text-white"}`}>Staff</button>
            <button type="button" onClick={() => { setEntry("admin"); setMode("login"); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${entry === "admin" ? "bg-aurora-a text-background" : "text-white/60 hover:text-white"}`}>Admin</button>
          </div>}
        </div>
        <div className="mt-3 rounded-[22px] bg-white p-4 shadow-xl shadow-black/10 sm:p-5">
        <div className="space-y-3">
          {isSignup && <label className="block text-xs font-medium text-fog">Name<div className="relative mt-2"><UserPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog/45" /><input required autoComplete="name" className="field pl-10" value={name} onChange={(e) => setName(e.target.value)} /></div></label>}
          <label className="block text-xs font-medium text-fog">Email<div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog/45" /><input required type="email" autoComplete="email" className="field bg-white text-slate-900 pl-10" value={email} onChange={(e) => setEmail(e.target.value)} /></div></label>
          {isLogin && <label className="block text-xs font-medium text-fog">Password<input required type="password" autoComplete="current-password" className="field mt-2 bg-white text-slate-900" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
          {!isLogin && <><label className="block text-xs font-medium text-fog">New password<input required minLength={12} type="password" autoComplete="new-password" className="field mt-2" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label className="block text-xs font-medium text-fog">Confirm password<input required minLength={12} type="password" autoComplete="new-password" className="field mt-2" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label><p className="text-xs text-fog/50">Use 12+ chars with upper/lowercase, a number, and a symbol.</p></>}
        </div>
        <button disabled={saving} className="group mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aurora-a to-aurora-b text-sm font-semibold text-background shadow-lg shadow-aurora-a/20 transition-all hover:brightness-105 disabled:opacity-60">{isSignup ? <UserPlus className="size-4" /> : !isLogin ? <KeyRound className="size-4" /> : null}{saving ? "Working..." : isLogin ? "Sign in" : isSignup ? "Create account" : "Update password"}{isLogin && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}</button>
        {isLogin && entry === "staff" && <div className="mt-4 text-center text-xs text-fog/65"><p>Already have access? Sign in above.</p><button type="button" onClick={() => setMode("signup")} className="mt-1 font-semibold text-aurora-a underline-offset-2 hover:underline">Create a staff account</button></div>}
        {isLogin && entry === "admin" && <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber/20 bg-amber/8 px-2.5 py-2 text-xs leading-4 text-fog/70"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber" /><span>Demo admin access: <strong className="text-strong">admin@veridian.local</strong> / <strong className="text-strong">admin123</strong></span></div>}
        </div>
        </form>}
        </div>
      </div>
    </main>
  );
}
