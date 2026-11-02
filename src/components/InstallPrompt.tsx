import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/lib/install";

/** A small card that offers to install the app. It shows after sign-in, never while signed out. */
export function InstallPrompt() {
  const { mode, install, dismiss } = useInstallPrompt();
  if (mode === null) return null;
  return (
    <div
      role="region"
      aria-label="Install StockLine"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-hair bg-panel p-3 shadow-2xl sm:left-auto sm:right-4 sm:max-w-sm sm:p-4 lg:bottom-4"
    >
      <div className="flex items-center gap-2 sm:items-start sm:gap-3">
        <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-aurora-a to-aurora-b text-background sm:grid">
          <Download className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-strong">Install StockLine</p>
          <p className={`mt-1 text-xs text-fog ${mode === "prompt" ? "hidden sm:block" : ""}`}>
            {mode === "prompt"
              ? "Add it to your device to open it like an app: full screen and one tap away."
              : "To install, tap the Share button, then choose Add to Home Screen."}
          </p>
        </div>
        {mode === "prompt" && (
          <button
            type="button"
            onClick={() => void install()}
            className="shrink-0 rounded-xl bg-gradient-to-r from-aurora-a to-aurora-b px-4 py-2 text-sm font-semibold text-background shadow-lg shadow-aurora-a/20 sm:hidden"
          >
            Install
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-fog hover:text-strong sm:size-auto"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className={`mt-3 justify-end gap-2 ${mode === "prompt" ? "hidden sm:flex" : "flex"}`}>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl border border-hair bg-panel/60 px-3.5 py-2 text-sm text-fog transition-colors hover:text-strong"
        >
          {mode === "prompt" ? "Not now" : "Got it"}
        </button>
        {mode === "prompt" && (
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-xl bg-gradient-to-r from-aurora-a to-aurora-b px-4 py-2 text-sm font-semibold text-background shadow-lg shadow-aurora-a/20"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
