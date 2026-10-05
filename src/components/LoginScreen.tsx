import { Eye, EyeOff, Menu, Moon, Sun } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import type { User } from "@/lib/db";

type AuthMode = "login" | "signup" | "forgot";
type EntryRole = User["role"];

const demoAccounts: Record<EntryRole, { email: string; password: string; label: string }> = {
  admin: { email: "name@stockline.demo", password: "Demo123!", label: "General Admin" },
  manager: { email: "name@stockline.demo", password: "Demo123!", label: "Manager" },
  staff: { email: "name@stockline.demo", password: "Demo123!", label: "Staff" },
};

export function LoginScreen() {
  const { login, signup, forgotPassword } = useAuth();
  const { mode: themeMode, toggle: toggleTheme } = useTheme();
  const [entry, setEntry] = useState<EntryRole>("admin");
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(demoAccounts.admin.email);
  const [password, setPassword] = useState(demoAccounts.admin.password);
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

  useEffect(() => {
    if (mode === "login") {
      setEmail(demoAccounts[entry].email);
      setPassword(demoAccounts[entry].password);
    }
  }, [entry, mode]);

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

  const isDark = themeMode === "dark";
  const isLogin = mode === "login";
  const isSignup = mode === "signup";

  return (
    <main className={`grid min-h-[100svh] ${isDark ? "bg-[#021c26] text-white" : "bg-[#f4f7f8] text-[#14232f]"} lg:grid-cols-[1.08fr_1fr]`}>
      <section className={`relative overflow-hidden px-4 py-5 sm:px-8 lg:px-10 lg:py-8 ${isDark ? "bg-[#021c26]" : "bg-[#0b2b35]"}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(78,205,164,0.16),transparent_26%),radial-gradient(circle_at_80%_90%,rgba(62,153,170,0.12),transparent_30%)]" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="grid size-10 place-items-center rounded-xl bg-[#4ecda4] text-[#021c26] shadow-[0_8px_20px_rgba(78,205,164,0.35)]">
            <Menu className="size-5" />
          </div>
          <div className={`text-2xl font-bold tracking-tight sm:text-3xl ${isDark ? "text-white" : "text-white"}`}>stockline</div>
        </div>

        <div className="relative z-10 mt-12 max-w-xl sm:mt-16 lg:mt-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4ecda4] sm:text-[13px]">Inventory operations</p>
          <h1 className={`mt-6 text-4xl font-semibold leading-[0.9] tracking-[-0.06em] sm:text-5xl lg:text-[5rem] ${isDark ? "text-white" : "text-white"}`}>
            Every location.
            <span className="mt-2 block">One clear view.</span>
          </h1>

          <p className={`mt-6 max-w-lg text-base leading-7 sm:text-xl sm:leading-8 ${isDark ? "text-slate-200/90" : "text-slate-200/90"}`}>
            Track stock, review requests and keep each branch in sync.
          </p>

          <div className={`mt-8 max-w-lg rounded-[20px] border p-4 shadow-[0_15px_30px_rgba(8,20,27,0.18)] backdrop-blur-sm sm:mt-10 ${isDark ? "border-white/10 bg-[#123747]/75" : "border-white/10 bg-[#123747]/75"}`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                <span className="text-base text-slate-200">Head Warehouse</span>
                <span className="text-right text-base font-medium text-[#4ecda4]">393 units</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                <span className="text-base text-slate-200">Accra Store</span>
                <span className="text-right text-base font-medium text-[#4ecda4]">2 low-stock items</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-base text-slate-200">Kumasi Store</span>
                <span className="text-right text-base font-medium text-[#4ecda4]">Awaiting approval</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`relative flex min-h-[45vh] items-center justify-center px-4 py-5 sm:px-6 lg:min-h-[100svh] lg:px-8 lg:py-6 ${isDark ? "bg-[#0d2d39] text-white" : "bg-[#eef3f5] text-[#14232f]"}`}>
        <div className="relative w-full max-w-[620px]">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={`absolute right-0 top-0 flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium shadow-[0_12px_24px_rgba(0,0,0,0.15)] backdrop-blur-sm transition-colors sm:px-4 sm:text-base ${
              isDark
                ? "border-white/10 bg-[#1d3c47]/70 text-white hover:bg-[#244b59]"
                : "border-[#d6dfe4] bg-white/80 text-[#14232f] hover:bg-white"
            }`}
          >
            {themeMode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {themeMode === "dark" ? "Light mode" : "Dark mode"}
          </button>

          <div className={`rounded-[28px] border p-5 shadow-[0_24px_56px_rgba(0,0,0,0.16)] sm:p-8 lg:p-10 ${isDark ? "border-white/10 bg-[#103744]" : "border-[#dfe4ea] bg-[#f6f8f9] shadow-[0_24px_56px_rgba(20,35,47,0.06)]"}`}>
            <div className={isDark ? "text-left" : "text-left"}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] sm:text-[13px] ${isDark ? "text-[#4ecda4]" : "text-[#0e8a6b]"}`}>Secure workspace</p>
              <h2 className={`mt-4 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl lg:text-[3.2rem] ${isDark ? "text-white" : "text-[#14232f]"}`}>Sign in to Stockline</h2>
              <p className={`mt-3 text-base sm:text-lg ${isDark ? "text-slate-200/80" : "text-[#7c8a96]"}`}>Access your assigned inventory and daily operations.</p>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <label className={`mb-2 block text-base font-medium ${isDark ? "text-white/90" : "text-[#3f4d5d]"}`}>Work email</label>
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-4 text-base outline-none transition ${
                    isDark
                      ? "border-white/10 bg-[#2a4d5a] text-white placeholder:text-slate-200/60 focus:border-[#4ecda4] focus:ring-2 focus:ring-[#4ecda4]/20"
                      : "border-[#d0d8de] bg-white text-[#14232f] placeholder:text-slate-500 focus:border-[#0e8a6b] focus:ring-2 focus:ring-[#0e8a6b]/20"
                  }`}
                  placeholder="name@stockline.demo"
                />
              </div>

              <div>
                <label className={`mb-2 block text-base font-medium ${isDark ? "text-white/90" : "text-[#3f4d5d]"}`}>Password</label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`w-full rounded-xl border px-4 py-4 pr-12 text-base outline-none transition ${
                      isDark
                        ? "border-white/10 bg-[#2a4d5a] text-white placeholder:text-slate-200/60 focus:border-[#4ecda4] focus:ring-2 focus:ring-[#4ecda4]/20"
                        : "border-[#d0d8de] bg-white text-[#14232f] placeholder:text-slate-500 focus:border-[#0e8a6b] focus:ring-2 focus:ring-[#0e8a6b]/20"
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className={`absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full transition ${
                      isDark ? "text-slate-200/80 hover:bg-white/5" : "text-[#7c8a96] hover:bg-slate-100"
                    }`}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="flex items-center justify-end">
                  <button type="button" onClick={() => setMode("forgot")} className={`text-base font-medium transition hover:underline ${isDark ? "text-[#4ecda4]" : "text-[#0e8a6b]"}`}>
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className={`flex w-full items-center justify-between rounded-xl px-6 py-4 text-left text-lg font-semibold shadow-[0_16px_32px_rgba(13,42,56,0.2)] transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  isDark
                    ? "bg-[#4ecda4] text-[#021c26] hover:bg-[#66d9b6] shadow-[0_16px_32px_rgba(78,205,164,0.25)]"
                    : "bg-[#0d2a38] text-white hover:bg-[#123747]"
                }`}
              >
                <span>{saving ? "Working..." : isLogin ? "Sign in" : isSignup ? "Create account" : "Update password"}</span>
                <span className="text-xl">→</span>
              </button>
            </form>

            {isLogin && (
              <div className={`mt-7 rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-[#1a3c48]/60" : "border-[#dfe4ea] bg-white/70"}`}>
                <p className={`text-center text-base ${isDark ? "text-slate-200" : "text-[#546679]"}`}>Choose a sample account</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(["admin", "manager", "staff"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setEntry(role);
                        setEmail(demoAccounts[role].email);
                        setPassword(demoAccounts[role].password);
                      }}
                      className={`rounded-xl border px-2 py-3 text-sm font-medium transition ${
                        entry === role
                          ? isDark
                            ? "border-[#4ecda4] bg-[#4ecda4]/10 text-white"
                            : "border-[#0e8a6b] bg-[#e7f7f2] text-[#0d2a38]"
                          : isDark
                            ? "border-white/10 bg-[#2a4d5a] text-slate-200 hover:border-[#4ecda4]/50"
                            : "border-[#d0d8de] bg-white text-[#3f4d5d] hover:border-[#9cb8c1]"
                      }`}
                    >
                      {demoAccounts[role].label}
                    </button>
                  ))}
                </div>
                <p className={`mt-4 text-center text-base ${isDark ? "text-slate-200" : "text-[#546679]"}`}>
                  Preview password: <span className={`font-medium ${isDark ? "text-[#4ecda4]" : "text-[#0e8a6b]"}`}>Demo123!</span>
                </p>
              </div>
            )}

            {!isLogin && (
              <button type="button" onClick={() => { setMode("login"); setPassword(""); setConfirmPassword(""); }} className={`mt-5 w-full text-center text-base font-medium hover:underline ${isDark ? "text-[#4ecda4]" : "text-[#0e8a6b]"}`}>
                Back to sign in
              </button>
            )}

            {isLogin && (
              <div className={`mt-7 text-center text-lg ${isDark ? "text-[#4ecda4]" : "text-[#0e8a6b]"}`}>
                Invited to join? <button type="button" onClick={() => setMode("signup")} className="font-medium underline">Preview account activation</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
