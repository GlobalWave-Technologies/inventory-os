import { useEffect } from "react";
import { registerOfflineWorker } from "@/lib/offlineSetup";
import { startPrivacyCover } from "@/lib/privacyCover";

/** Starts the small browser-only helpers once the app is on screen. */
export function AppBoot() {
  useEffect(() => {
    startPrivacyCover();
    registerOfflineWorker();
  }, []);
  return null;
}
