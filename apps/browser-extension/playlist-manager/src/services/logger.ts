// Logger utility for the extension. It respects a LOG_LEVEL environment variable (default "info").
// In production builds you can set LOG_LEVEL=error to silence debug/info logs.

type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function getLogLevel(): LogLevel {
  // In the browser we don't have process.env; we can read a global variable if set.
  // Fallback to "info".
  // @ts-ignore – window may be undefined during build.
  const level = typeof window !== "undefined" && window.LOG_LEVEL;
  if (typeof level === "string" && level in LEVEL_ORDER) {
    return level as LogLevel;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[getLogLevel()];
}

export const logger = {
  error: (...args: any[]) => {
    if (shouldLog("error")) console.error(...args);
  },
  warn: (...args: any[]) => {
    if (shouldLog("warn")) console.warn(...args);
  },
  info: (...args: any[]) => {
    if (shouldLog("info")) console.info(...args);
  },
  debug: (...args: any[]) => {
    if (shouldLog("debug")) console.debug(...args);
  },
};
