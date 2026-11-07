import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const STAMP = "lastActive"; // only a time of day: it says nothing about what anyone did
const WARN_SECONDS = 60;

/** Signs the person out after a while with no touching, typing or scrolling. Admins get a shorter time. */
export function IdleSignOut() {
  const { user, isAdmin, logout } = useAuth();
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const lastActive = useRef(Date.now());
  const lastWrite = useRef(0);
  const [left, setLeft] = useState<number | null>(null);
  const userId = user?.id ?? null;
  const minutes = isAdmin ? 10 : 15;

  useEffect(() => {
    if (!userId) {
      setLeft(null);
      return;
    }
    const limitMs = minutes * 60_000;
    const mark = () => {
      const now = Date.now();
      lastActive.current = now;
      if (now - lastWrite.current > 10_000) {
        lastWrite.current = now;
        try {
          localStorage.setItem(STAMP, String(now));
        } catch {
          /* storage can be blocked; this tab still keeps its own time */
        }
      }
    };
    lastWrite.current = 0;
    mark();

    const check = () => {
      let last = lastActive.current;
      try {
        const other = Number(localStorage.getItem(STAMP));
        if (other > last) last = other; // activity in another tab counts too
      } catch {
        /* ignore */
      }
      const idle = Date.now() - last;
      if (idle >= limitMs) {
        setLeft(null);
        toast.info(`Signed out after ${minutes} minutes without activity.`);
        logoutRef.current();
        return;
      }
      const remaining = Math.ceil((limitMs - idle) / 1000);
      setLeft(remaining <= WARN_SECONDS ? remaining : null);
    };

    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const name of events) window.addEventListener(name, mark, { passive: true, capture: true });
    // Phones pause timers while the screen is off, so time spent away is checked the moment the app returns.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 1000);
    return () => {
      for (const name of events) window.removeEventListener(name, mark, { capture: true });
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [userId, minutes]);

  if (left === null) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-[1000] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-hair bg-panel p-4 shadow-xl"
    >
      <p className="text-sm text-strong">You will be signed out in {left}s because of inactivity.</p>
      <button
        type="button"
        onClick={() => {
          lastActive.current = Date.now();
          setLeft(null);
        }}
        className="shrink-0 rounded-lg border border-hair px-3 py-2 text-sm text-strong"
      >
        Stay signed in
      </button>
    </div>
  );
}
