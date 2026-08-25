import { Notyf } from "notyf";
import "notyf/notyf.min.css";

// Guard to prevent duplicate declarations on SPA navigation
if (window._utilsLoaded) {
  console.warn("utils already loaded - skipping");
} else {
  window._utilsLoaded = true;
}

// Only initialize Notyf if document is available (UI context)
if (typeof window !== "undefined" && typeof window.document !== "undefined") {
  const notify = new Notyf({
    duration: 5000,
    dismissible: true,
  });

  const inform = new Notyf({
    duration: 5000,
    dismissible: true,
    types: [
      {
        type: "info",
        background: "#007bff",
        icon: false,
      },
    ],
  });

  window.error = (message) => {
    notify.error(message);
    return () => notify.dismissAll();
  };
  window.success = (message) => {
    notify.success(message);
    return () => notify.dismissAll();
  };
  window.info = (message) => {
    inform.open({ type: "info", message });
    return () => inform.dismissAll();
  };
} else {
  // Mock implementations for background worker to prevent reference errors
  window.error = (msg) => {
    console.error(msg);
    return () => {};
  };
  window.success = (msg) => {
    console.log("SUCCESS:", msg);
    return () => {};
  };
  window.info = (msg) => {
    console.log("INFO:", msg);
    return () => {};
  };
}

let _pendingLogs: string[] = [];
let _flushTimer: any = null;

async function flushLogsToStorage() {
  if (typeof browser === "undefined" || !browser.storage) return;
  if (_pendingLogs.length === 0) return;
  const toFlush = [..._pendingLogs];
  _pendingLogs = [];

  try {
    const key = "yph_system_logs";
    const result = await browser.storage.local.get(key);
    const logs: string[] = result[key] || [];
    let maxLogLines = 500;
    try {
      if (typeof window.getSettings === "function") {
        const s = await window.getSettings();
        if (s && s.maxLogLines) maxLogLines = s.maxLogLines;
      }
    } catch {}

    logs.push(...toFlush);
    while (logs.length > maxLogLines) {
      logs.shift();
    }

    await browser.storage.local.set({ [key]: logs });
  } catch (e) {
    console.error("Failed to write to system logs", e);
  }
}

window.logSystemEvent = async (level: "INFO" | "ERROR" | "WARN", message: any, details?: any) => {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const msgStr = typeof message === "object" ? JSON.stringify(message) : String(message);
  let logMessage = `[${timestamp}] [${level}] ${msgStr}`;
  if (details) {
    const detailsStr = typeof details === "object" ? JSON.stringify(details) : String(details);
    logMessage += ` | ${detailsStr}`;
  }
  console.log(logMessage);

  if (typeof browser === "undefined" || !browser.storage) return;
  _pendingLogs.push(logMessage);
  if (!_flushTimer) {
    _flushTimer = setTimeout(() => {
      _flushTimer = null;
      flushLogsToStorage();
    }, 400);
  }
};

window.secsToISO = (secs: number): string => {
  const s = Math.floor(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return "PT" + (h ? `${h}H` : "") + (m ? `${m}M` : "") + (sec || (!h && !m) ? `${sec}S` : "");
};

window.isoToSecs = (iso: string): number => {
  if (!iso) return 0;
  // Handle P[n]DT[n]H[n]M[n]S format
  const match = /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(iso);
  if (!match) return 0;
  const d = parseInt(match[1] ?? "0", 10);
  const h = parseInt(match[2] ?? "0", 10);
  const m = parseInt(match[3] ?? "0", 10);
  const s = parseFloat(match[4] ?? "0");
  return d * 86400 + h * 3600 + m * 60 + Math.floor(s);
};
