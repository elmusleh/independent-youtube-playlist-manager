/**
 * Pure schedule formatting, clamping, and preset helpers for Sync v2 periodic & event triggers.
 *
 * WebExtension `alarms.create` supports `periodInMinutes >= 1` in packed MV3 extensions across
 * Chrome, Edge, and Firefox. `0` disables periodic background polling ("Manual only").
 */

export const MIN_SYNC_INTERVAL_MINUTES = 1;
export const MAX_SYNC_INTERVAL_MINUTES = 10_080; // 7 days (168 hours)

export const SYNC_INTERVAL_PRESETS = [
  { minutes: 0, label: "Manual only" },
  { minutes: 5, label: "5 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "24 hours" },
] as const;

export type DurationUnit = "minutes" | "hours";

/** Clamp an arbitrary minute value into `0` (manual) or `[1, 10080]`. */
export function clampSyncIntervalMinutes(raw: unknown, fallback = 5): number {
  if (raw === 0) return 0;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  if (raw <= 0) return 0;
  return Math.min(MAX_SYNC_INTERVAL_MINUTES, Math.max(MIN_SYNC_INTERVAL_MINUTES, Math.round(raw)));
}

/** Convert `{ amount, unit }` from the custom duration form into clamped minutes. */
export function toIntervalMinutes(amount: number, unit: DurationUnit): number {
  if (!Number.isFinite(amount) || amount <= 0) return MIN_SYNC_INTERVAL_MINUTES;
  const rawMinutes = unit === "hours" ? amount * 60 : amount;
  return clampSyncIntervalMinutes(rawMinutes, MIN_SYNC_INTERVAL_MINUTES);
}

/** Decompose stored minutes into `{ amount, unit }` for editing in the custom duration inputs. */
export function decomposeIntervalMinutes(minutes: number): {
  amount: number;
  unit: DurationUnit;
} {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { amount: 15, unit: "minutes" };
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return { amount: minutes / 60, unit: "hours" };
  }
  return { amount: minutes, unit: "minutes" };
}

/** Human-readable description of a sync interval (`0` -> `"Manual only"`, `5` -> `"Every 5 min"`). */
export function formatSyncInterval(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Manual only";
  const m = Math.round(minutes);
  if (m < 60) return m === 1 ? "Every 1 min" : `Every ${m} min`;
  if (m % 1440 === 0) {
    const days = m / 1440;
    return days === 1 ? "Every 24 hours" : `Every ${days} days`;
  }
  if (m % 60 === 0) {
    const hours = m / 60;
    return hours === 1 ? "Every 1 hour" : `Every ${hours} hours`;
  }
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  return `Every ${hours} hr ${rem} min`;
}

/** Format an upcoming `browser.alarms` `scheduledTime` epoch into a relative + clock string. */
export function formatNextScheduledCheck(
  scheduledTime: number | null | undefined,
  now = Date.now()
): string | null {
  if (typeof scheduledTime !== "number" || !Number.isFinite(scheduledTime) || scheduledTime <= 0) {
    return null;
  }
  const diffMs = scheduledTime - now;
  const clock = new Date(scheduledTime).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (diffMs <= 30_000) return `in < 1 min (${clock})`;
  const totalMin = Math.round(diffMs / 60_000);
  if (totalMin < 60) return `in ${totalMin} min (${clock})`;
  const hours = Math.floor(totalMin / 60);
  const rem = totalMin % 60;
  const rel = rem > 0 ? `in ${hours} hr ${rem} min` : `in ${hours} hr`;
  return `${rel} (${clock})`;
}
