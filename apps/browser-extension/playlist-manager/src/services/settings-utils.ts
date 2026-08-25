import type { Settings } from "../types/model.js";

// ─── Constants ───────────────────────────────────────────────────────────────

export const CREATE_NEW = "__create_new__";
export const HISTORY_KEY = "local_yt_history";

export const PAGE_SIZES = [10, 20, 30, 40, 50, 100, 250, 500];

export const CACHE_DURATIONS = [
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 1440, label: "24 hours" },
  { value: -1, label: "No expiration" },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

export function focusEl(node: HTMLElement) {
  node.focus();
}

// ─── Save Utility ────────────────────────────────────────────────────────────

export async function saveSetting(
  key: keyof Settings,
  value: unknown,
  status: { save: (fn: () => Promise<void>) => Promise<void> },
  onDone?: () => void
) {
  await status.save(async () => {
    try {
      await window.storeObject(key as string, value);
      if (onDone) onDone();
      if (window.logSystemEvent)
        await window.logSystemEvent("INFO", `[SETTINGS] Saved setting: ${key}`);
      if (window.success) window.success("Setting saved");
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[SETTINGS] Failed to save ${key}:`, e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[SETTINGS] Failed to save ${key}: ${errMsg}`);
      if (window.error) window.error(`Failed to save setting: ${errMsg}`);
      throw e;
    }
  });
}
