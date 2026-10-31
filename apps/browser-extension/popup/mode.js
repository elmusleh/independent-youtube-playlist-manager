/**
 * Popup mode + theme, applied before any stylesheet so there is no flash and the
 * popup is never sized by viewport feedback. Runs as a classic (non-module) script
 * before popup.css. No inline script or CSP exception is required.
 *
 * - A browser action popup exposes itself via extension.getViews({ type: "popup" });
 *   when the page is opened as a full tab (Firefox Android, dev/tests) that set is
 *   empty and we fall back to full-page mode.
 * - The theme is read from the same localStorage key the SPA editor maintains
 *   ("yph-theme-choice"), then corrected asynchronously once storage answers.
 */
(function () {
  const root = document.documentElement;

  // 1) popup vs full page/tab
  let isPopup = false;
  try {
    const api = window.browser || window.chrome;
    if (api && api.extension && typeof api.extension.getViews === "function") {
      const views = api.extension.getViews({ type: "popup" }) || [];
      isPopup = views.indexOf(window) !== -1;
    }
  } catch {
    /* no extension API (e.g. served test page) -> page mode */
  }

  // Explicit override for dev/tests.
  try {
    const mode = new URLSearchParams(window.location.search).get("mode");
    if (mode === "popup") isPopup = true;
    else if (mode === "page") isPopup = false;
  } catch {
    /* ignore malformed query */
  }

  root.classList.add(isPopup ? "ui-popup" : "ui-page");
  root.dataset.mode = isPopup ? "popup" : "page";

  // 2) theme before first paint
  try {
    const choice = localStorage.getItem("yph-theme-choice");
    const theme =
      choice === "dark" || choice === "light"
        ? choice
        : matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
    /* CSS still follows the device theme if storage is unavailable. */
  }
})();
