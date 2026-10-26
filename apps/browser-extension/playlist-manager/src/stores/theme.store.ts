import { derived, get, readable, writable, type Readable } from "svelte/store";
import type { Theme, ThemeChoice } from "../types/model.js";

const themeStorageKey = "themeChoice";

function initialChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem("yph-theme-choice");
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  return "device";
}
export const theme = writable<ThemeChoice>(initialChoice());

export const currentTheme: Readable<Theme> = derived(theme, ($theme) => {
  if ($theme !== "device") return $theme;
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
});

function updatePageTheme() {
  document.documentElement.dataset.theme = get(currentTheme);
  document.documentElement.style.colorScheme = get(currentTheme);
  try {
    localStorage.setItem("yph-theme-choice", get(theme));
  } catch {}
}

export function initTheme() {
  window
    .fetchObject(themeStorageKey, "device")
    .then((themeChoice: any) => {
      theme.set(themeChoice);
      theme.subscribe((themeChoice) => {
        window.storeObject(themeStorageKey, themeChoice);
        updatePageTheme();
      });
      updatePageTheme();
    })
    .catch(async (e) => {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[THEME-STORE] Failed to initialize theme:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[THEME-STORE] Failed to initialize theme: ${errMsg}`);
      updatePageTheme();
    });
}
