import { useCallback, useEffect, useState } from "react";

// The browser fires "beforeinstallprompt" once, often before anyone has signed in.
// This file catches it at start-up and keeps it, so the install card and the Settings
// page can both offer the install later in the same visit.
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "stockline-install-dismissed";
const QUIET_MS = 14 * 24 * 60 * 60 * 1000;

let deferred: InstallEvent | null = null;
let installedThisVisit = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // hide the browser's own bar; our card and Settings replace it
    deferred = event as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedThisVisit = true;
    notify();
  });
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private window: the card may come back sooner, nothing breaks */
  }
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < QUIET_MS;
  } catch {
    return false;
  }
}

function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

// The browser lets each saved install event be used once, so it is taken out before use.
async function runInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  notify();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

export type InstallMode = "prompt" | "ios" | null;

/** The card that pops up after sign-in. "Not now" silences it for 14 days. */
export function useInstallPrompt() {
  const [ready, setReady] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!recentlyDismissed() && !isInstalled()) timer = setTimeout(() => setReady(true), 1500);
    return () => {
      listeners.delete(listener);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const mode: InstallMode = !ready ? null : deferred ? "prompt" : isIos() ? "ios" : null;

  const dismiss = useCallback(() => {
    rememberDismissal();
    setReady(false);
  }, []);

  const install = useCallback(async () => {
    const outcome = await runInstall();
    if (outcome === "dismissed") rememberDismissal();
    setReady(false);
  }, []);

  return { mode, install, dismiss };
}

/** For the Settings page: always available, whatever was chosen on the card. */
export function useInstallStatus() {
  const [, bump] = useState(0);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(isInstalled());
    setIos(isIos());
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const install = useCallback(async () => {
    await runInstall();
  }, []);

  return { installed: standalone || installedThisVisit, ios, canPrompt: deferred !== null, install };
}
