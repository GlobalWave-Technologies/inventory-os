import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PrimaryButton } from "@/components/AppShell";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" makes the confirm button red. Use it for archive, deactivate and cancel. */
  tone?: "normal" | "danger";
};

type Pending = ConfirmOptions & { resolve: (answer: boolean) => void };

let show: ((request: Pending) => void) | null = null;

/** Asks "are you sure?" in our own dialog. Resolves true if they confirm, false otherwise. */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) {
      resolve(false); // no dialog on screen (for example during server rendering): do nothing
      return;
    }
    show({ ...options, resolve });
  });
}

/** Mount once, near the top of the app. */
export function ConfirmHost() {
  const [request, setRequest] = useState<Pending | null>(null);
  const requestRef = useRef<Pending | null>(null);
  requestRef.current = request;
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = (next) => {
      requestRef.current?.resolve(false); // a newer question replaces an older one
      setRequest(next);
    };
    return () => {
      show = null;
    };
  }, []);

  const answer = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };

  useEffect(() => {
    if (!request) return;
    cancelRef.current?.focus(); // the safe choice is the one under the keyboard
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        request.resolve(false);
        setRequest(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [request]);

  const danger = request?.tone === "danger";

  return (
    <AnimatePresence>
      {request && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => answer(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={request.message ? "confirm-message" : undefined}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="glass relative w-full max-w-sm rounded-3xl p-5"
          >
            <h2 id="confirm-title" className="font-display text-lg font-semibold text-strong">
              {request.title}
            </h2>
            {request.message && (
              <p id="confirm-message" className="mt-1.5 text-sm text-fog/80">
                {request.message}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => answer(false)}
                className="rounded-xl border border-hair px-4 py-2 text-sm font-medium text-fog hover:text-strong"
              >
                {request.cancelLabel ?? "Cancel"}
              </button>
              {danger ? (
                <button
                  type="button"
                  onClick={() => answer(true)}
                  className="rounded-xl bg-rose px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  {request.confirmLabel ?? "Confirm"}
                </button>
              ) : (
                <PrimaryButton onClick={() => answer(true)}>{request.confirmLabel ?? "Confirm"}</PrimaryButton>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
