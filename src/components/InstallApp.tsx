import { PrimaryButton } from "@/components/AppShell";
import { useInstallStatus } from "@/lib/install";
import { useSingleFlight } from "@/lib/useSingleFlight";

/** Settings card: install the app at any time, even after choosing "Not now" on the pop-up. */
export function InstallApp() {
  const { installed, ios, canPrompt, install } = useInstallStatus();
  const { run, pending } = useSingleFlight();

  let text: string;
  if (installed) text = "StockLine is installed on this device. Open it from your home screen or app list.";
  else if (canPrompt) text = "Add StockLine to your device to open it like an app: full screen and one tap away.";
  else if (ios) text = "On iPhone or iPad: tap the Share button, then choose Add to Home Screen.";
  else
    text =
      "Open your browser's menu and choose Install app (or Add to Home screen). On a computer, look for the install icon at the right end of the address bar.";

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <p className="label-mono">This device</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-strong">Install the app</h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-fog/75">{text}</p>
        {!installed && canPrompt && (
          <PrimaryButton disabled={pending} onClick={() => void run(install)}>
            Install app
          </PrimaryButton>
        )}
      </div>
    </section>
  );
}
