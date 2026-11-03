import { writable } from "svelte/store";
import { push } from "svelte-spa-router";

const browser = (window as any).browser || (window as any).chrome;

export type ShortcutAction =
  "newPlaylist" | "manage" | "history" | "favorite" | "saved" | "settings";

export interface ShortcutKey {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface ShortcutsConfig {
  enabled: boolean;
  mappings: Record<ShortcutAction, ShortcutKey>;
}

export const defaultMappings: Record<ShortcutAction, ShortcutKey> = {
  newPlaylist: { key: "N", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false },
  manage: { key: "M", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false },
  history: { key: "H", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false },
  favorite: { key: "F", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false },
  saved: { key: "P", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false },
  settings: { key: "S", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false },
};

const defaultConfig: ShortcutsConfig = {
  enabled: true,
  mappings: { ...defaultMappings },
};

function createShortcutsStore() {
  const { subscribe, set, update } = writable<ShortcutsConfig>(defaultConfig);

  return {
    subscribe,
    set,
    update,
    init: async () => {
      try {
        const storage = browser.storage.sync || browser.storage.local;
        const result = await storage.get("yph_shortcuts");
        if (result.yph_shortcuts) {
          set(result.yph_shortcuts);
        } else {
          set(defaultConfig);
        }
      } catch (e) {
        console.error("Failed to load shortcuts from storage", e);
      }
    },
    save: async (config: ShortcutsConfig) => {
      set(config);
      try {
        const storage = browser.storage.sync || browser.storage.local;
        await storage.set({ yph_shortcuts: config });
      } catch (e) {
        console.error("Failed to save shortcuts to storage", e);
      }
    },
    reset: async () => {
      set(defaultConfig);
      try {
        const storage = browser.storage.sync || browser.storage.local;
        await storage.set({ yph_shortcuts: defaultConfig });
      } catch (e) {
        console.error("Failed to reset shortcuts", e);
      }
    },
  };
}

export const shortcutsStore = createShortcutsStore();

// Attach global listener
if (typeof window !== "undefined") {
  shortcutsStore.init();

  let config: ShortcutsConfig;
  shortcutsStore.subscribe((c) => {
    config = c;
  });

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!config?.enabled) return;

    // Ignore if typing in an input, textarea, or contenteditable
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    ) {
      return;
    }

    const matchesShortcut = (shortcut: ShortcutKey, event: KeyboardEvent) => {
      return (
        event.key.toUpperCase() === shortcut.key.toUpperCase() &&
        event.ctrlKey === shortcut.ctrlKey &&
        event.altKey === shortcut.altKey &&
        event.shiftKey === shortcut.shiftKey &&
        event.metaKey === shortcut.metaKey
      );
    };

    if (matchesShortcut(config.mappings.newPlaylist, e)) {
      e.preventDefault();
      push("/new");
    } else if (matchesShortcut(config.mappings.manage, e)) {
      e.preventDefault();
      push("/manage");
    } else if (matchesShortcut(config.mappings.history, e)) {
      e.preventDefault();
      push("/history");
    } else if (matchesShortcut(config.mappings.favorite, e)) {
      e.preventDefault();
      push("/favorite");
    } else if (matchesShortcut(config.mappings.saved, e)) {
      e.preventDefault();
      push("/saved");
    } else if (matchesShortcut(config.mappings.settings, e)) {
      e.preventDefault();
      push("/settings");
    }
  });
}
