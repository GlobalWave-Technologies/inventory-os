import { useRouter, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

// Every page is a separate file that the phone downloads the first time you open it. On a slow
// connection that download is the pause where "nothing happens". After sign-in, and once the
// phone is idle, these are fetched quietly in the background so the tap opens instantly.
const PAGES = ["/purchasing", "/profit-loss", "/sales", "/transfers", "/counts", "/adjustments", "/items"] as const;

export function RoutePreloader() {
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const run = () => {
      for (const to of PAGES) void router.preloadRoute({ to }).catch(() => undefined);
    };
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
    if (idle) idle(run);
    else window.setTimeout(run, 1500);
  }, [user, router]);
  return null;
}

/** A thin moving bar at the top while a page is opening, so a tap always gets an answer. */
export function RouteProgress() {
  const loading = useRouterState({ select: (state) => state.isLoading });
  if (!loading) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden">
      <motion.div
        className="h-full w-1/3 bg-aurora-a"
        initial={{ x: "-100%" }}
        animate={{ x: "300%" }}
        transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
      />
    </div>
  );
}
