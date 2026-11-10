import { useRouter, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

// Every page is a separate file that the phone downloads the first time you open it. On a slow
// connection that download is the pause where "nothing happens". After sign-in, and once the
// phone is idle, these are fetched quietly in the background so the tap opens instantly.
const PAGES = ["/purchasing", "/profit-loss", "/sales", "/transfers", "/counts", "/adjustments", "/items"] as const;

export function RoutePreloader() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // True once every data request the page made has finished. Preloading waits for that, so the page you
  // opened is never slowed down by pages you have not opened.
  const quiet = useIsFetching() === 0;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!userId || !quiet) return;
    const to = PAGES[step];
    if (!to) return; // all done
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      void router.preloadRoute({ to }).catch(() => undefined);
      setStep((n) => n + 1); // next page, again only when the app is quiet
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [userId, quiet, step, router]);

  // A new sign-in starts the list again.
  useEffect(() => {
    setStep(0);
  }, [userId]);

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
