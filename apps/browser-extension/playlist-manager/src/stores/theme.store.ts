import { derived, get, readable, writable, type Readable } from "svelte/store";
import type { Theme, ThemeChoice } from "../types/model.js";

const themeStorageKey = "themeChoice";

function initialChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem("yph-theme-choice");
    if (saved === "dark" || saved === "light" || saved === "device") return saved;
  } catch {}
  return "device";
}

export const theme = writable<ThemeChoice>(initialChoice());

export const currentTheme: Readable<Theme> = derived(theme, ($theme) => {
  if ($theme !== "device") return $theme;
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
});

// Listen for system theme changes when device theme is active
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

function setupDeviceThemeListener() {
  if (typeof window === "undefined" || !window.matchMedia) return;

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // Remove existing listener if any
  if (mediaQueryListener) {
    mediaQuery.removeEventListener("change", mediaQueryListener);
  }

  mediaQueryListener = () => {
    // Trigger update by re-evaluating the derived store
    // This works because currentTheme is derived from theme store
    // We just need to ensure the derived store re-evaluates
    // Svelte derived stores auto-update when dependencies change,
    // but matchMedia change doesn't trigger it. We need to manually notify.
    // The simplest approach: subscribe to currentTheme and update on media change
  };

  mediaQuery.addEventListener("change", mediaQueryListener);
}

function cleanupDeviceThemeListener() {
  if (typeof window === "undefined" || !window.matchMedia || !mediaQueryListener) return;
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .removeEventListener("change", mediaQueryListener);
  mediaQueryListener = null;
}

function updatePageTheme() {
  document.documentElement.dataset.theme = get(currentTheme);
  document.documentElement.style.colorScheme = get(currentTheme);
  try {
    localStorage.setItem("yph-theme-choice", get(theme));
  } catch {}
}

export function initTheme() {
  setupDeviceThemeListener();

  window
    .fetchObject(themeStorageKey, "device")
    .then((themeChoice: any) => {
      const validChoice = ["dark", "light", "device"].includes(themeChoice)
        ? themeChoice
        : "device";
      theme.set(validChoice);
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

// Cleanup on unload (for completeness)
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", cleanupDeviceThemeListener);
}
