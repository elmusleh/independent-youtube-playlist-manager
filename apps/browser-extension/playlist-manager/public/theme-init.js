/* global document, localStorage, matchMedia */
// Classic external script runs before the app/CSS; no inline script or CSP exception.
try {
  const choice = localStorage.getItem("yph-theme-choice");
  const theme = choice === "dark" || choice === "light" ? choice :
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
} catch { /* CSS still follows the device theme if browser storage is unavailable. */ }
