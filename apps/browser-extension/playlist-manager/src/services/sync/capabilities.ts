/**
 * Browser/device capability detection for the sync feature.
 *
 * Answers "will File/Syncthing work on *this* browser/device?" with a grounded,
 * feature-detected answer rather than a hardcoded list. This drives the ✅ / ⚠️ / ❌
 * badges shown in the Sync view.
 *
 * Ground truth (verified 2026-11-02):
 * - The File System Access *pickers* (`showOpenFilePicker` / `showDirectoryPicker`) are
 *   Chromium-only. Firefox and Safari do not implement them.
 * - Firefox for Android runs extensions (v120+) but has no file-system access.
 * - Chrome for Android has no extension support at all (we never run there).
 */

export type Capability = "yes" | "partial" | "no";

export type Platform = "chrome" | "edge" | "firefox" | "firefox-android" | "unknown";

export type DeviceCapabilities = {
  platform: Platform;
  /** True when not a phone/tablet browser. */
  isDesktop: boolean;
  /** Human-readable label for the current platform. */
  platformLabel: string;
  /** File System Access pickers available (Chromium desktop). */
  hasFileSystemAccess: boolean;
  /** Supabase works on every platform where the extension runs. */
  supabase: Capability;
  /** File / Syncthing capability + the reason it is (not) available. */
  file: Capability;
  fileNote: string;
};

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  const isEdge = /Edg\//i.test(ua);

  if (isFirefox) return isAndroid ? "firefox-android" : "firefox";
  if (isEdge) return "edge";
  if (/Chrome/i.test(ua)) return "chrome";
  return "unknown";
}

function hasFileSystemAccess(): boolean {
  if (typeof window === "undefined") return false;
  return "showOpenFilePicker" in window && "showDirectoryPicker" in window;
}

export function detectCapabilities(): DeviceCapabilities {
  const platform = detectPlatform();
  const fsAccess = hasFileSystemAccess();
  const isDesktop = platform === "chrome" || platform === "edge" || platform === "firefox";

  const platformLabel: Record<Platform, string> = {
    chrome: "Chrome",
    edge: "Edge",
    firefox: "Firefox",
    "firefox-android": "Firefox for Android",
    unknown: "this browser",
  };

  let file: Capability = "no";
  let fileNote: string;

  if (fsAccess) {
    file = "yes";
    fileNote = "Works on this browser.";
  } else if (platform === "firefox") {
    // Firefox desktop has the downloads API but no folder picker; deferred per owner.
    file = "no";
    fileNote = "Firefox does not allow apps to pick a folder. Coming later via Downloads.";
  } else if (platform === "firefox-android") {
    file = "no";
    fileNote = "Phone browsers cannot read or write your files.";
  } else {
    file = "no";
    fileNote = "Not available on this browser.";
  }

  return {
    platform,
    isDesktop,
    platformLabel: platformLabel[platform],
    hasFileSystemAccess: fsAccess,
    supabase: "yes",
    file,
    fileNote,
  };
}
