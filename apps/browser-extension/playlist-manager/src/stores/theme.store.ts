import { derived, get, readable, writable, type Readable } from "svelte/store";
import type { Theme, ThemeChoice } from "../types/model.js";

// The synchronous pre-paint cache uses `yph-theme-choice` in localStorage, but
// the persistent setting must stay `themeChoice` so getSettings() and the popup
// read the same value. Changing this to the localStorage key disconnects them.
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

const VALID_CHOICES: ThemeChoice[] = ["dark", "light", "device"];
// Chromium can answer the first extension-storage read of a fresh page with an
// empty object, which silently dropped a persisted (or synced) choice. Retry a
// few times before falling back to the synchronous pre-paint cache.
const READ_ATTEMPTS = 4;
const READ_DELAY_MS = 120;

async function readStoredChoice(): Promise<ThemeChoice | null> {
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt += 1) {
    const stored: string = await window.fetchObject(themeStorageKey, "");
    if (VALID_CHOICES.includes(stored as ThemeChoice)) return stored as ThemeChoice;
    if (attempt < READ_ATTEMPTS - 1)
      await new Promise((resolve) => setTimeout(resolve, READ_DELAY_MS));
  }
  return null;
}

let initialized = false;
export function initTheme() {
  if (initialized) return;
  initialized = true;
  currentTheme.subscribe(() => updatePageTheme());

  readStoredChoice()
    .then((stored) => {
      if (stored) theme.set(stored);
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
