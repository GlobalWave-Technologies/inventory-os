// Registers the offline page helper. Only on the live site, never while developing.
let registered = false;

export function registerOfflineWorker() {
  if (registered || typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  registered = true;
  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
