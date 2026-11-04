import { useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { registerOfflineWorker } from "@/lib/offlineSetup";
import { startPrivacyCover } from "@/lib/privacyCover";

// The pages an account can reopen on. The server keeps the same list and refuses anything else.
const PAGES = [
  "/", "/activity", "/adjustments", "/categories", "/counts", "/items",
  "/notifications", "/profit-loss", "/purchasing", "/sales", "/settings", "/transfers",
];
const WAITING = "\u0000waiting"; // marks "a new login is still looking up its page"

/**
 * Starts the small browser-only helpers, and reopens each account on the page it last used.
 * The page is kept on the server, so nothing about it is stored in the browser.
 */
export function AppBoot() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = useLocation({ select: (l) => l.pathname });
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const wasSignedOut = useRef(false); // true once the sign-in screen has been shown
  const arriving = useRef<string | null>(null); // the page a new login is moving to
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    startPrivacyCover();
    registerOfflineWorker();
    // Earlier versions kept page names in the browser. Remove them.
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith("lastPage:")) localStorage.removeItem(key);
    } catch {
      /* storage can be blocked */
    }
  }, []);

  // A fresh sign-in opens that account's last page, or the Overview if it has none.
  // A plain reload while signed in does not come through here, so it stays where it is.
  useEffect(() => {
    if (user === null) {
      wasSignedOut.current = true;
      arriving.current = null;
      lastSent.current = null;
    }
    if (!user || !wasSignedOut.current) return;
    wasSignedOut.current = false;
    arriving.current = WAITING;
    void apiRequest<{ page: string | null }>("/me/last-page")
      .then((r) => (r.page && PAGES.includes(r.page) ? r.page : "/"))
      .catch(() => "/")
      .then((target) => {
        if (target === pathRef.current) {
          arriving.current = null;
          return;
        }
        arriving.current = target;
        try {
          router.history.replace(target);
        } catch {
          arriving.current = null;
        }
      });
  }, [user, router]);

  // Save the page this account is on (not the previous person's page), at most once every 1.5 seconds.
  useEffect(() => {
    if (!user || !PAGES.includes(pathname)) return;
    if (arriving.current === WAITING) return;
    if (arriving.current !== null) {
      if (pathname !== arriving.current) return; // still moving to the saved page
      arriving.current = null;
    }
    if (pathname === lastSent.current) return;
    const timer = window.setTimeout(() => {
      lastSent.current = pathname;
      void apiRequest("/me/last-page", { method: "PUT", body: JSON.stringify({ page: pathname }) }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [user, pathname]);

  return null;
}
