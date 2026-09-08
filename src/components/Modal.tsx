import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className={`glass relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl ${
              wide ? "sm:max-w-3xl" : "sm:max-w-lg"
            }`}
          >
            <div className="flex items-start gap-3 border-b border-hair px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-lg font-semibold text-strong">{title}</h2>
                {subtitle && <p className="mt-0.5 truncate text-xs text-fog/70">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-hair text-fog hover:text-strong"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="glass card3d flex flex-col items-center rounded-2xl px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-aurora-a/25 bg-aurora-a/10 text-aurora-a">
        {icon}
      </div>
      <p className="mt-4 font-display text-base font-semibold text-strong">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-fog/75">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingPanels({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-hair bg-panel/40"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
