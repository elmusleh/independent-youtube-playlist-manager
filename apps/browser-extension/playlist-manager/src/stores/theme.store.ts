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

const deviceTheme = readable<Theme>(
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light",
  (set) => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => set(media.matches ? "dark" : "light");
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }
);
export const currentTheme: Readable<Theme> = derived([theme, deviceTheme], ([$theme, $device]) =>
  $theme === "device" ? $device : $theme
);

function updatePageTheme() {
  document.documentElement.dataset.theme = get(currentTheme);
  document.documentElement.style.colorScheme = get(currentTheme);
  try {
    localStorage.setItem("yph-theme-choice", get(theme));
  } catch {}
}

let initialized = false;
export function initTheme() {
  if (initialized) return;
  initialized = true;
  currentTheme.subscribe(() => updatePageTheme());

  window
    .fetchObject(themeStorageKey, get(theme))
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
