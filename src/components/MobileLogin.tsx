import { ArrowRight, Box, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

type MobileLoginProps = {
  isDark: boolean;
  onToggleTheme: () => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
};

function ThemeButton({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/5"
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

function Fields({
  isDark,
  email,
  onEmailChange,
  password,
  onPasswordChange,
}: Pick<MobileLoginProps, "isDark" | "email" | "onEmailChange" | "password" | "onPasswordChange">) {
  const [showPassword, setShowPassword] = useState(false);
  const label = `text-sm font-medium ${isDark ? "text-white/85" : "text-[#3f4d5d]"}`;
  const input = `h-[52px] w-full rounded-full border px-5 text-base outline-none transition focus:ring-2 ${
    isDark
      ? "border-[#2a4d5f] bg-[#173649] text-white placeholder:text-slate-300/60 focus:border-[#4ecda4] focus:ring-[#4ecda4]/20"
      : "border-[#d7dde3] bg-white text-[#14232f] placeholder:text-slate-500 focus:border-[#0e8a6b] focus:ring-[#0e8a6b]/20"
  }`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="mobile-email" className={`mb-2 block ${label}`}>
          Work email
        </label>
        <input
          id="mobile-email"
          required
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className={input}
          placeholder="name@company.com"
        />
      </div>
      <div>
        <label htmlFor="mobile-password" className={`mb-2 block ${label}`}>
          Password
        </label>
        <div className="relative">
          <input
            id="mobile-password"
            required
            type={showPassword ? "text" : "password"}
            maxLength={200}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className={`${input} pr-14`}
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className={`absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full transition ${
              isDark ? "text-slate-200/90 hover:bg-white/5" : "text-[#5f6d7a] hover:bg-slate-100"
            }`}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        <div className="mt-2.5 text-right">
          <a
            href="/forgot-password"
            className={`text-sm font-semibold underline-offset-4 hover:underline ${isDark ? "text-[#5ed2a5]" : "text-[#1c7a5c]"}`}
          >
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ isDark, saving }: { isDark: boolean; saving: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className={`flex h-14 w-full items-center justify-between rounded-full px-7 text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
        isDark ? "bg-white text-[#0f2a38] hover:bg-slate-100" : "bg-[#0f2a38] text-white hover:bg-[#163649]"
      }`}
    >
      <span>{saving ? "Signing in..." : "Sign in"}</span>
      <ArrowRight className="size-5" />
    </button>
  );
}

function Brand({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid size-9 place-items-center rounded-[10px] ${isDark ? "bg-white text-[#0f2a38]" : "bg-[#24825f] text-white"}`}>
        <Box className="size-5" />
      </span>
      <span className="text-lg font-bold tracking-tight text-white">Stockline</span>
    </div>
  );
}

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.24em] text-[#5ed2a5]";

function DarkLogin({ isDark, onToggleTheme, saving, onSubmit, ...fields }: MobileLoginProps) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[#0f2a38] px-6 pb-8 pt-14 text-white lg:hidden">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="flex items-center justify-between">
          <Brand isDark={isDark} />
          <ThemeButton isDark={isDark} onToggle={onToggleTheme} />
        </div>
        <p className={`mt-12 ${EYEBROW}`}>Secure workspace</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">Sign in to Stockline</h1>
        <p className="mt-3 text-[15px] leading-[1.5] text-slate-200/80">Access your assigned inventory and daily operations.</p>
        <form onSubmit={onSubmit} className="mt-8 flex flex-1 flex-col">
          <Fields isDark={isDark} {...fields} />
          <div className="mt-auto pt-10">
            <SubmitButton isDark={isDark} saving={saving} />
          </div>
        </form>
      </div>
    </div>
  );
}

function LightLogin({ isDark, onToggleTheme, saving, onSubmit, ...fields }: MobileLoginProps) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[#0f2a38] lg:hidden">
      <header className="mx-auto w-full max-w-lg px-6 pb-11 pt-14 text-white">
        <div className="flex items-center justify-between">
          <Brand isDark={isDark} />
          <ThemeButton isDark={isDark} onToggle={onToggleTheme} />
        </div>
        <p className={`mt-7 ${EYEBROW}`}>Secure workspace</p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight">Welcome back to your stockroom.</h1>
        <p className="mt-2.5 text-[15px] leading-[1.5] text-slate-200/80">Access your assigned inventory and daily operations.</p>
      </header>
      <section className="flex flex-1 flex-col rounded-t-[32px] bg-[#f7f8fa] px-6 pb-8 pt-8 text-[#14232f]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <form onSubmit={onSubmit} className="mt-3.5">
            <Fields isDark={isDark} {...fields} />
            <div className="mt-6">
              <SubmitButton isDark={isDark} saving={saving} />
            </div>
          </form>
          <p className="mt-auto pt-10 text-center text-[13px] text-[#5f6d7a]">
            Trouble signing in?{" "}
            <button
              type="button"
              onClick={() => toast.info("Ask your admin to check your account or reset your access.")}
              className="font-semibold text-[#1c7a5c] underline underline-offset-2"
            >
              Contact your admin
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}

export function MobileLogin(props: MobileLoginProps) {
  return props.isDark ? <DarkLogin {...props} /> : <LightLogin {...props} />;
}
