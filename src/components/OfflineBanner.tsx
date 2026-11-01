import { useEffect, useState } from "react";

/** A strip at the top of the screen while the device has no connection. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const goOffline = () => {
      if (timer) clearTimeout(timer);
      setJustBack(false);
      setOffline(true);
    };
    const goOnline = () => {
      setOffline(false);
      setJustBack(true);
      timer = setTimeout(() => setJustBack(false), 3000);
    };
    if (!navigator.onLine) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline && !justBack) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[70] px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-center text-sm font-semibold text-white ${
        offline ? "bg-rose" : "bg-aurora-a"
      }`}
    >
      {offline ? "You're offline. Changes can't be saved until you reconnect." : "Back online"}
    </div>
  );
}
