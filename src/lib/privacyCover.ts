// When the app goes into the background (the phone's recent-apps screen, a locked screen, another
// tab), a plain cover with the logo is shown so the screenshot the phone takes of the window
// does not show stock levels, prices or names. It is removed the moment the app comes back.
//
// It is plain DOM on purpose: it must appear in the same instant the page is hidden, which is
// faster than waiting for React to draw. Phones decide when they take that screenshot, so this
// works on most devices but is a best effort, not a guarantee.
let started = false;

export function startPrivacyCover() {
  if (started || typeof window === "undefined") return;
  started = true;

  const cover = document.createElement("div");
  cover.setAttribute("aria-hidden", "true");
  cover.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;background:var(--background,#0F1B27)";
  const logo = document.createElement("img");
  logo.src = "/stockline-logo.svg";
  logo.alt = "";
  logo.style.cssText = "width:72px;height:72px";
  cover.appendChild(logo);
  document.body.appendChild(cover);

  const show = () => {
    cover.style.display = "flex";
  };
  const hide = () => {
    cover.style.display = "none";
  };
  // The window also loses focus when the phone's saved-password sheet or the keyboard's suggestions open.
  // That is not the app leaving the screen, so the early focus signal is ignored while a field is being used.
  const showOnBlur = () => {
    // autofill-only: skip just when typing in a text-like box on a screen with a password field.
    const field = document.activeElement;
    const typing = field instanceof HTMLInputElement && ["text", "email", "password", "search", "tel"].includes(field.type);
    if (typing && document.querySelector('input[type="password"]')) return;
    show();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") show();
    else hide();
  });
  window.addEventListener("pagehide", show);
  window.addEventListener("pageshow", hide);
  window.addEventListener("blur", showOnBlur);
  window.addEventListener("focus", hide);
  // Safety: if the cover is ever left on screen, a tap clears it.
  cover.addEventListener("pointerdown", hide);
}
