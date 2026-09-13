import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Boxes, LayoutDashboard, Moon, Package, Settings, Sun, History, LogOut, ChartNoAxesCombined } from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import { useBootstrap } from "@/lib/ledger";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { PortalPicker } from "@/components/PortalPicker";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/items", label: "Items", icon: Package },
  { to: "/categories", label: "Categories", icon: Boxes },
  { to: "/activity", label: "Movement log", icon: History },
  { to: "/profit-loss", label: "Profit & loss", icon: ChartNoAxesCombined },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuroraField() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="aurora absolute -left-40 -top-40 size-[520px] rounded-full bg-aurora-a/20 blur-[120px]" />
      <div
        className="aurora absolute right-[-10%] top-[-5%] size-[560px] rounded-full bg-aurora-c/20 blur-[130px]"
        style={{ animationDelay: "-4s" }}
      />
      <div
        className="aurora absolute bottom-[-20%] left-[40%] size-[600px] rounded-full bg-aurora-b/15 blur-[140px]"
        style={{ animationDelay: "-8s" }}
      />
    </div>
  );
}

function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="grid size-10 shrink-0 place-items-center rounded-xl border border-hair bg-panel/60 text-fog transition-colors hover:text-strong"
    >
      {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function AppShell({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  eyebrow: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  useBootstrap();
  const { user, isAdmin, logout, portalId } = useAuth();

  if (user === undefined) return null;
  if (!user) return <LoginScreen />;
  if (!isAdmin && !portalId) return <PortalPicker />;
  const visibleNav = nav.filter((entry) => isAdmin || (entry.to !== "/categories" && entry.to !== "/profit-loss"));

  return (
    <div className="relative min-h-screen w-full text-fog">
      <AuroraField />

      <div className="relative mx-auto flex max-w-[1440px] px-4 pb-28 pt-5 sm:px-5 lg:px-8 lg:pb-8">
        {/* desktop rail */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col gap-6 lg:flex">
          <div className="flex items-center gap-3 px-2">
            <img src="/inventory-control-logo.svg" alt="Inventory Control" className="size-12 shrink-0 rounded-lg bg-white object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-strong">StockLine</p>
              <p className="label-mono mt-0.5">Inventory OS</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {visibleNav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-fog/80 transition-colors hover:text-strong"
                activeProps={{
                  className: "!border-aurora-a/30 bg-aurora-a/10 font-medium !text-strong",
                }}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-hair bg-panel/60 p-3">
            <p className="truncate px-1 text-sm font-medium text-strong">{user.name}</p>
            <p className="label-mono mt-0.5 px-1">{isAdmin ? "Administrator" : "Staff account"}</p>
            <p className="label-mono px-1">Storage</p>
            <p className="mt-2 px-1 text-xs leading-relaxed text-fog/80">
              Everything is saved in this browser only. Export a backup regularly.
            </p>
            {isAdmin && <Link to="/settings" className="mt-3 block rounded-lg border border-amber/30 px-3 py-1.5 text-center text-xs font-medium text-amber">Manage workspace</Link>}
            <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-hair px-3 py-1.5 text-xs text-fog hover:text-strong"><LogOut className="size-3.5" /> Sign out</button>
          </div>
        </aside>

        <main className="ml-0 w-full min-w-0 flex-1 lg:ml-8">
          <header className="mb-5 grid grid-cols-1 items-center gap-4 sm:flex sm:flex-wrap sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="label-mono">{eyebrow}</p>
              <h1 className="truncate font-display text-xl font-semibold text-strong sm:text-2xl">
                {title}
              </h1>
            </div>
            <div className="flex items-center justify-self-end gap-3 sm:gap-4">
              <ThemeToggle />
              <span className="hidden text-right sm:block"><span className="block text-xs font-medium text-strong">{user.name}</span><span className="label-mono">{isAdmin ? "Admin" : "Staff"}</span></span>
              {actions}
            </div>
          </header>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-panel/85 backdrop-blur-xl lg:hidden">
        <div className={`mx-auto grid max-w-lg ${visibleNav.length === 6 ? "grid-cols-6" : visibleNav.length === 5 ? "grid-cols-5" : visibleNav.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-fog/70"
              activeProps={{ className: "!text-aurora-a" }}
            >
              <Icon className="size-[18px]" />
              <span className="max-w-full truncate px-1">{label.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl bg-gradient-to-r from-aurora-a to-aurora-b px-4 py-2.5 text-sm font-semibold text-background shadow-lg shadow-aurora-a/20 transition-transform hover:-translate-y-0.5 active:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border border-hair bg-panel/60 px-3.5 py-2.5 text-sm text-fog transition-colors hover:text-strong ${className}`}
    >
      {children}
    </button>
  );
}
