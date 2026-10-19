import { Eye, EyeOff, Menu, Moon, Sun } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export function LoginScreen() {
  const { login } = useAuth();
  const { mode: themeMode, toggle: toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await login(email, password);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSaving(false);
    }
  }

  const isDark = themeMode === "dark";

  return (
    <main
      className={`grid h-[100svh] min-h-[100svh] grid-cols-1 overflow-hidden ${isDark ? "bg-[#021c26] text-white" : "bg-[#f4f7f8] text-[#14232f]"} lg:grid-cols-[1.08fr_1fr]`}
    >
      <section
        className={`relative hidden overflow-hidden px-4 py-5 sm:px-8 lg:block lg:px-8 lg:py-6 ${isDark ? "bg-[#021c26]" : "bg-[#0b2b35]"}`}
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(78,205,164,0.16),transparent_26%),radial-gradient(circle_at_80%_90%,rgba(62,153,170,0.12),transparent_30%)]"
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center gap-4">
          <div className="grid size-10 place-items-center rounded-xl bg-[#4ecda4] text-[#021c26] shadow-[0_8px_20px_rgba(78,205,164,0.35)]">
            <Menu className="size-5" />
          </div>
          <div
            className={`text-2xl font-bold tracking-tight sm:text-3xl ${isDark ? "text-white" : "text-white"}`}
          >
            stockline
          </div>
        </div>

        <div className="relative z-10 mt-12 max-w-xl sm:mt-16 lg:mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4ecda4] sm:text-[13px]">
            Inventory operations
          </p>
          <h1
            className={`mt-5 text-4xl font-semibold leading-[0.9] tracking-[-0.06em] sm:text-5xl lg:text-6xl xl:text-7xl ${isDark ? "text-white" : "text-white"}`}
          >
            Every location.
            <span className="mt-2 block">One clear view.</span>
          </h1>

          <p
            className={`mt-5 max-w-lg text-base leading-7 sm:text-xl sm:leading-8 lg:text-lg lg:leading-7 ${isDark ? "text-slate-200/90" : "text-slate-200/90"}`}
          >
            Track stock, review requests and keep each branch in sync.
          </p>

          <div
            className={`mt-6 max-w-lg rounded-[20px] border p-4 shadow-[0_15px_30px_rgba(8,20,27,0.18)] backdrop-blur-sm ${isDark ? "border-white/10 bg-[#123747]/75" : "border-white/10 bg-[#123747]/75"}`}
          >
            <div className="space-y-2">
              <p className="text-lg font-semibold text-white">
                Know your stock. Trust your next move.
              </p>
              <p className="text-sm leading-6 text-slate-200/85">
                One clearer view helps every location spot what matters and keep the day moving.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`relative flex h-full min-h-0 items-center justify-center overflow-hidden px-3 py-2 sm:px-6 sm:py-3 lg:px-8 lg:py-4 ${isDark ? "bg-[#0d2d39] text-white" : "bg-[#eef3f5] text-[#14232f]"}`}
      >
        <div className="relative flex max-h-full w-full max-w-[620px] flex-col justify-center">
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

          <div
            className={`rounded-[24px] border p-3 shadow-[0_24px_56px_rgba(0,0,0,0.16)] sm:p-6 lg:p-8 ${isDark ? "border-white/10 bg-[#103744]" : "border-[#dfe4ea] bg-[#f6f8f9] shadow-[0_24px_56px_rgba(20,35,47,0.06)]"}`}
          >
            <div className={isDark ? "text-left" : "text-left"}>
              <p
                className={`text-[11px] font-semibold uppercase tracking-[0.24em] sm:text-[13px] ${isDark ? "text-[#4ecda4]" : "text-[#0e8a6b]"}`}
              >
                Secure workspace
              </p>
              <h2
                className={`mt-1 text-2xl font-semibold tracking-[-0.06em] sm:mt-3 sm:text-3xl lg:text-[2.5rem] ${isDark ? "text-white" : "text-[#14232f]"}`}
              >
                Sign in to Stockline
              </h2>
              <p
                className={`mt-1 text-xs leading-5 sm:mt-2 sm:text-base ${isDark ? "text-slate-200/80" : "text-[#7c8a96]"}`}
              >
                Access your assigned inventory and daily operations.
              </p>
            </div>

            <form onSubmit={submit} className="mt-2 space-y-1.5 sm:mt-5 sm:space-y-4">
              <div>
                <label
                  className={`mb-1 block text-sm font-medium sm:text-base ${isDark ? "text-white/90" : "text-[#3f4d5d]"}`}
                >
                  Work email
                </label>
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-2 text-base outline-none transition sm:py-3 ${
                    isDark
                      ? "border-white/10 bg-[#2a4d5a] text-white placeholder:text-slate-200/60 focus:border-[#4ecda4] focus:ring-2 focus:ring-[#4ecda4]/20"
                      : "border-[#d0d8de] bg-white text-[#14232f] placeholder:text-slate-500 focus:border-[#0e8a6b] focus:ring-2 focus:ring-[#0e8a6b]/20"
                  }`}
                  placeholder="name@stockline.demo"
                />
              </div>

              <div>
                <label
                  className={`mb-1 block text-sm font-medium sm:text-base ${isDark ? "text-white/90" : "text-[#3f4d5d]"}`}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`w-full rounded-xl border px-4 py-2 pr-12 text-base outline-none transition sm:py-3 ${
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
                      isDark
                        ? "text-slate-200/80 hover:bg-white/5"
                        : "text-[#7c8a96] hover:bg-slate-100"
                    }`}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className={`flex w-full items-center justify-between rounded-xl px-5 py-2.5 text-left text-base font-semibold shadow-[0_16px_32px_rgba(13,42,56,0.2)] transition disabled:cursor-not-allowed disabled:opacity-70 sm:py-3.5 sm:text-lg ${
                  isDark
                    ? "bg-[#4ecda4] text-[#021c26] hover:bg-[#66d9b6] shadow-[0_16px_32px_rgba(78,205,164,0.25)]"
                    : "bg-[#0d2a38] text-white hover:bg-[#123747]"
                }`}
              >
                <span>{saving ? "Signing in..." : "Sign in"}</span>
                <span className="text-xl">→</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
