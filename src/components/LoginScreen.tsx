import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import type { User } from "@/lib/db";

type AuthMode = "login" | "signup" | "forgot";
type EntryRole = User["role"];

export function LoginScreen() {
  const { login, signup, forgotPassword } = useAuth();
  const { mode: themeMode, toggle: toggleTheme } = useTheme();
  const [entry, setEntry] = useState<EntryRole>("admin");
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberRole, setRememberRole] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem("stockline-login-role");
    if (savedRole === "admin" || savedRole === "manager" || savedRole === "staff") {
      setEntry(savedRole);
      setRememberRole(true);
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (mode === "login") {
        const ok = await login(email, password, entry ?? "staff");
        if (!ok) {
          toast.error(`Incorrect ${entry ?? "staff"} email or password.`);
          return;
        }
        if (rememberRole) localStorage.setItem("stockline-login-role", entry);
        else localStorage.removeItem("stockline-login-role");
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
  const title = isLogin ? "Welcome back" : isSignup ? "Create your workspace" : "Recover access";
  const description = isLogin
    ? "Sign in to your inventory workspace"
    : isSignup
      ? "Set up a private StockLine account for your inventory team."
      : "Choose a new password for your local StockLine account.";

  return (
    <main className="relative isolate grid min-h-[100svh] place-items-center overflow-hidden bg-background px-4 py-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] text-strong">
      <img src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80&fm=webp" alt="" aria-hidden="true" fetchPriority="high" decoding="async" className="absolute inset-0 size-full object-cover" />
      <div aria-hidden="true" className="absolute inset-0 bg-background/55 backdrop-blur-[1px] dark:bg-background/70" />
      <section className="glass relative w-full max-w-[400px] rounded-[28px] p-6 shadow-[8px_8px_20px_rgba(43,48,59,0.12),_-8px_-8px_20px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.3),_-8px_-8px_20px_rgba(255,255,255,0.04)] sm:p-8">
        <button type="button" onClick={toggleTheme} aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-fog transition-colors hover:bg-background">
          {themeMode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <div className="mx-auto grid size-[76px] place-items-center rounded-full border border-aurora-a">
          <div className="grid size-[54px] place-items-center rounded-full bg-background text-aurora-a shadow-[4px_4px_9px_rgba(43,48,59,0.12),_-4px_-4px_9px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_9px_rgba(0,0,0,0.28),_-4px_-4px_9px_rgba(255,255,255,0.04)]">
            <img src="/stockline-logo.svg" alt="StockLine logo" className="size-8" />
          </div>
        </div>

        <div className="mt-5 text-center">
          <h1 className="font-display text-2xl font-semibold text-strong">StockLine</h1>
          <p className="mt-1 text-sm text-fog/75">{description}</p>
        </div>

        {isLogin && <div className="mt-6 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sign in as">
          {(["admin", "manager", "staff"] as const).map((role) => <button key={role} type="button" role="radio" aria-checked={entry === role} onClick={() => setEntry(role)} className={`min-w-0 rounded-xl px-2 py-2.5 text-sm capitalize transition-colors ${entry === role ? "bg-aurora-a font-semibold text-white shadow-inner" : "bg-background text-fog shadow-[3px_3px_7px_rgba(43,48,59,0.10),_-3px_-3px_7px_rgba(255,255,255,0.85)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.25),_-3px_-3px_7px_rgba(255,255,255,0.04)]"}`}>{role}</button>)}
        </div>}

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {isSignup && <label className="block text-sm text-fog">Name<input required autoComplete="name" className="field mt-1.5" value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label className="block text-sm text-fog">Email address<input required type="email" autoComplete="username" className="field mt-1.5" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="block text-sm text-fog">{isLogin ? "Password" : "New password"}
            <span className="relative mt-1.5 block">
              <input required minLength={isLogin ? undefined : 12} type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} className="field pr-11" placeholder={isLogin ? "Enter your password" : "Choose a new password"} value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-fog hover:bg-background">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          {isSignup && <label className="block text-sm text-fog">Confirm password<input required minLength={12} type="password" autoComplete="new-password" className="field mt-1.5" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /><span className="mt-1 block text-xs text-fog/65">Use 12+ characters with upper/lowercase, a number, and a symbol.</span></label>}

          {isLogin && <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-fog"><input type="checkbox" checked={rememberRole} onChange={(event) => setRememberRole(event.target.checked)} className="size-4 accent-aurora-a" />Remember role</label>
            <button type="button" onClick={() => setMode("forgot")} className="font-medium text-aurora-a hover:underline">Forgot password?</button>
          </div>}

          <button type="submit" disabled={saving} className="mt-2 h-[50px] w-full rounded-full bg-gradient-to-r from-aurora-a to-aurora-b text-base font-semibold text-white shadow-[4px_4px_12px_rgba(242,84,79,0.22)] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
            {saving ? "Working..." : isLogin ? "Sign in" : isSignup ? "Create account" : "Update password"}
          </button>
        </form>

        {isLogin && <p className="mt-5 text-center text-sm text-fog/75">Demo only. <button type="button" onClick={() => { const demo = { admin: ["admin@veridian.local", "Admin123!"], manager: ["manager@veridian.local", "Manager1234!"], staff: ["staff@veridian.local", "Staff1234!"] } as const; setEmail(demo[entry][0]); setPassword(demo[entry][1]); }} className="font-medium text-aurora-a hover:underline">Fill demo login</button></p>}
        {!isLogin && <button type="button" onClick={() => { setMode("login"); setPassword(""); setConfirmPassword(""); }} className="mt-4 w-full text-center text-sm font-medium text-aurora-a hover:underline">Back to sign in</button>}
        {isLogin && (entry === "staff" || entry === "admin") && <button type="button" onClick={() => setMode("signup")} className="mt-3 w-full text-center text-sm font-medium text-aurora-a hover:underline">Create a staff account</button>}
      </section>
    </main>
  );
}
