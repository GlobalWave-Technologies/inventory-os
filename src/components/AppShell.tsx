import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Activity, Bell, Boxes, ClipboardCheck, ClipboardList, LayoutDashboard, MapPinned, Moon, MoreHorizontal, Package, PackageSearch, RotateCcw, Settings, ShoppingCart, Sun, Truck, Warehouse, ChartNoAxesCombined, LogOut, Users, ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTheme } from "@/lib/theme";
import { useBootstrap } from "@/lib/ledger";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LoginScreen } from "@/components/LoginScreen";
import { PortalPicker } from "@/components/PortalPicker";
import { LoadingPanels } from "@/components/Modal";

type OperationsSection = "requests" | "transfers" | "stocktaking" | "returns" | "purchasing" | "suppliers" | "thresholds" | "notifications";
type NavigationEntry = { to: "/" | "/items" | "/categories" | "/activity" | "/profit-loss" | "/reports" | "/settings" | "/admin"; label: string; icon: typeof Package; section?: OperationsSection; roles?: readonly ("admin" | "manager" | "staff")[]; badge?: number };

const adminNavigation: NavigationEntry[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/items", label: "Inventory", icon: Package },
  { to: "/categories", label: "Products & categories", icon: Boxes },
  { to: "/admin", section: "requests", label: "Requests & approvals", icon: ClipboardCheck, badge: 0 },
  { to: "/admin", section: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { to: "/admin", section: "stocktaking", label: "Stocktaking", icon: ClipboardList },
  { to: "/admin", section: "returns", label: "Sales & returns", icon: RotateCcw },
  { to: "/admin", section: "purchasing", label: "Purchasing", icon: ShoppingCart },
  { to: "/admin", section: "suppliers", label: "Suppliers", icon: Truck },
  { to: "/admin", section: "thresholds", label: "Thresholds", icon: SlidersHorizontal },
  { to: "/profit-loss", label: "Reports", icon: ChartNoAxesCombined },
  { to: "/settings", label: "Settings & permissions", icon: Settings },
  { to: "/activity", label: "Activity log", icon: Activity },
  { to: "/admin", section: "notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Team & location", icon: MapPinned },
];

const teamNavigation: NavigationEntry[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/items", label: "Inventory", icon: Package },
  { to: "/categories", label: "Products & categories", icon: Boxes, roles: ["manager"] },
  { to: "/admin", section: "requests", label: "Requests & approvals", icon: ClipboardCheck, roles: ["manager"] },
  { to: "/admin", section: "transfers", label: "Transfers", icon: ArrowLeftRight, roles: ["manager"] },
  { to: "/admin", section: "stocktaking", label: "Stocktaking", icon: ClipboardList, roles: ["manager"] },
  { to: "/admin", section: "returns", label: "Sales & returns", icon: RotateCcw, roles: ["manager"] },
  { to: "/admin", section: "purchasing", label: "Purchasing", icon: ShoppingCart, roles: ["manager"] },
  { to: "/admin", section: "suppliers", label: "Suppliers", icon: Truck, roles: ["manager"] },
  { to: "/admin", section: "thresholds", label: "Thresholds", icon: SlidersHorizontal, roles: ["manager"] },
  { to: "/profit-loss", label: "Reports", icon: ChartNoAxesCombined, roles: ["manager"] },
  { to: "/activity", label: "Activity log", icon: Activity },
  { to: "/admin", section: "notifications", label: "Notifications", icon: Bell, roles: ["manager", "staff"] },
  { to: "/reports", label: "Daily reports", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings },
];

function WorkspaceLink({ entry, mobile = false, mobileMenu = false, onNavigate }: { entry: NavigationEntry; mobile?: boolean; mobileMenu?: boolean; onNavigate?: () => void }) {
  const Icon = entry.icon;
  const className = mobileMenu
    ? "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-fog transition-colors hover:bg-background/70 hover:text-strong"
    : mobile
      ? "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] text-fog/70"
      : "group relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm text-fog transition-all hover:border-hair hover:bg-white hover:text-strong dark:hover:bg-panel";
  const children = <><Icon className={mobile ? "size-[18px]" : "size-[18px] shrink-0 transition-transform group-hover:scale-110"} /><span className={mobile ? "max-w-full truncate px-1" : "min-w-0 flex-1"}>{mobile ? entry.label.split(" ")[0] : entry.label}</span>{(!mobile || mobileMenu) && entry.badge !== undefined && entry.badge > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">{entry.badge}</span>}</>;
  const activeClass = mobile ? "!text-aurora-a" : "!border-[#F2544F]/35 bg-[#FDEAE8] font-medium !text-strong shadow-[inset_0_0_20px_-14px_rgba(242,84,79,0.18)] dark:!border-aurora-a/60 dark:bg-nav-active";
  if (entry.section) return <Link to="/admin" search={{ section: entry.section }} activeOptions={{ exact: false }} onClick={onNavigate} className={className} activeProps={{ className: activeClass }}>{children}</Link>;
  return <Link to={entry.to} activeOptions={{ exact: entry.to === "/" }} onClick={onNavigate} className={className} activeProps={{ className: activeClass }}>{children}</Link>;
}

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
  const bootstrapped = useBootstrap();
  const { user, isAdmin, logout, portalId } = useAuth();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const operationCounts = useLiveQuery(async () => {
    const database = db();
    const [requests, transfers, orders, lowStock] = await Promise.all([
      database.branchRequests.where("status").equals("pending").count(),
      database.transfers.toArray(),
      database.purchaseOrders.where("status").equals("ordered").count(),
      database.items.filter((item) => !item.deletedAt && item.quantity <= item.lowStockThreshold).count(),
    ]);
    const transferAlerts = transfers.filter((transfer) => transfer.status === "pending" || transfer.status === "in-transit" || (transfer.status === "received" && Date.now() - Date.parse(transfer.receivedAt ?? "") < 7 * 24 * 60 * 60 * 1000)).length;
    return { requests, alerts: requests + transferAlerts + orders + lowStock };
  }, []);

  if (user === undefined) return null;
  if (!user) return <LoginScreen />;
  if (!bootstrapped) {
    return <main className="min-h-screen bg-background p-4 pt-8 sm:p-8"><LoadingPanels count={4} /></main>;
  }
  if (!isAdmin && !portalId) return <PortalPicker />;
  const visibleNav = isAdmin
    ? adminNavigation.map((entry) => {
        const badge = entry.section === "requests" ? operationCounts?.requests ?? 0 : entry.section === "notifications" ? operationCounts?.alerts ?? 0 : undefined;
        return badge === undefined ? entry : { ...entry, badge };
      })
    : teamNavigation.filter((entry) => !entry.roles || entry.roles.includes(user.role));
    const mobilePrimaryNav = visibleNav.slice(0, 4);
    const mobileMoreNav = visibleNav.slice(4);

  return (
    <div className="relative min-h-screen w-full text-fog">
      <AuroraField />

      <div className="relative mx-auto flex w-full min-w-0 max-w-[1440px] px-3 pb-28 pt-5 sm:px-5 lg:px-8 lg:pb-8">
        {/* desktop rail */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col rounded-[28px] border border-hair bg-[#F5E9E7] p-3 text-strong shadow-[0_18px_40px_-28px_rgba(43,48,59,0.25)] dark:bg-sidebar dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.8)] lg:flex">
          <div className="flex items-center gap-3 rounded-2xl border border-hair bg-panel/80 px-3 py-3 shadow-sm">
            <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-white shadow-lg shadow-black/5">
              <img src="/inventory-control-logo.svg" alt="Inventory Control" className="size-11 rounded-lg object-contain" />
              <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full border-2 border-panel bg-aurora-a" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl leading-none text-strong">StockLine</p>
              <p className="label-mono mt-1 text-fog">Inventory OS</p>
            </div>
          </div>

          <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:thin]">
            <p className="label-mono px-3 pb-2 pt-1 text-fog">Workspace</p>
            {visibleNav.map((entry, index) => <WorkspaceLink key={`${entry.to}-${entry.section ?? entry.label}-${index}`} entry={entry} />)}
          </nav>

          <div className="mt-auto rounded-2xl border border-hair bg-[#F8F1F0] p-2 dark:bg-panel">
            <button onClick={logout} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-hair px-3 py-2.5 text-xs text-fog transition-colors hover:border-rose/60 hover:bg-rose/10 hover:text-strong"><LogOut className="size-3.5" /> Sign out</button>
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
            <div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-between justify-self-stretch gap-2 sm:w-auto sm:flex-nowrap sm:justify-self-auto sm:gap-4">
              <ThemeToggle />
              <span className="hidden text-right sm:block"><span className="block text-xs font-medium text-strong">{user.name}</span><span className="label-mono capitalize">{user.role}</span></span>
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

      {mobileMoreOpen && <button type="button" aria-label="Close navigation menu" onClick={() => setMobileMoreOpen(false)} className="fixed inset-0 z-30 bg-black/20 lg:hidden" />}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-panel/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden">
        {mobileMoreOpen && <div className="absolute inset-x-3 bottom-full mb-2 flex max-h-[min(70vh,32rem)] flex-col overflow-hidden rounded-2xl border border-hair bg-panel p-2 shadow-2xl">
          <p className="label-mono px-3 py-2">All sections</p>
          <div className="min-h-0 overflow-y-auto"><div className="flex flex-col gap-1">{mobileMoreNav.map((entry, index) => <WorkspaceLink key={`more-${entry.to}-${entry.section ?? entry.label}-${index}`} entry={entry} mobileMenu onNavigate={() => setMobileMoreOpen(false)} />)}</div></div>
          <div className="mt-2 shrink-0 border-t border-hair px-1 pt-2">
            <p className="truncate px-2 text-sm font-medium text-strong">{user.name}</p>
            <div className="mt-1 flex items-center justify-between gap-3 px-2">
              <span className="label-mono capitalize">{user.role}</span>
              <button type="button" onClick={() => { setMobileMoreOpen(false); logout(); }} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-rose transition-colors hover:bg-rose/10">
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </div>
        </div>}
        <div className="mx-auto grid w-full min-w-0 max-w-lg grid-cols-5 gap-1 px-1 pt-1">
          {mobilePrimaryNav.map((entry, index) => <WorkspaceLink key={`mobile-${entry.to}-${entry.section ?? entry.label}-${index}`} entry={entry} mobile />)}
          {mobileMoreNav.length > 0 && <button type="button" aria-expanded={mobileMoreOpen} onClick={() => setMobileMoreOpen((open) => !open)} className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] ${mobileMoreOpen ? "text-aurora-a" : "text-fog/70"}`}><MoreHorizontal className="size-[18px]" /><span>More</span></button>}
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
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-xl bg-gradient-to-r from-aurora-a to-aurora-b px-4 py-2.5 text-sm font-semibold text-background shadow-lg shadow-aurora-a/20 transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-wait disabled:opacity-60 ${className}`}
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
