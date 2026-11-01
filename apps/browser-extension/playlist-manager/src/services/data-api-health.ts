export type DataApiHealthState = "unknown" | "ok" | "quota_exceeded" | "rate_limited" | "invalid";

export interface DataApiHealth {
  state: DataApiHealthState;
  blockedUntil: number;
  lastChecked: number;
  message: string;
}

const STORAGE_KEY = "metadata_data_api_health";
const HOUR = 60 * 60 * 1000;

const EMPTY: DataApiHealth = {
  state: "unknown",
  blockedUntil: 0,
  lastChecked: 0,
  message: "",
};

function storageArea(): any {
  return (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
}

export async function readDataApiHealth(): Promise<DataApiHealth> {
  try {
    const area = storageArea();
    if (!area) return { ...EMPTY };
    const stored = await area.get(STORAGE_KEY);
    const value = stored?.[STORAGE_KEY];
    if (!value || typeof value !== "object") return { ...EMPTY };
    return {
      state: value.state || "unknown",
      blockedUntil: Number(value.blockedUntil) || 0,
      lastChecked: Number(value.lastChecked) || 0,
      message: typeof value.message === "string" ? value.message : "",
    };
  } catch {
    return { ...EMPTY };
  }
}

async function writeDataApiHealth(next: DataApiHealth): Promise<DataApiHealth> {
  try {
    const area = storageArea();
    if (area) await area.set({ [STORAGE_KEY]: next });
  } catch {
    /* health is a best-effort UI hint; never block metadata fetches */
  }
  return next;
}

export async function resetDataApiHealth(): Promise<DataApiHealth> {
  return writeDataApiHealth({ ...EMPTY });
}

export async function markDataApiSuccess(): Promise<DataApiHealth> {
  return writeDataApiHealth({
    state: "ok",
    blockedUntil: 0,
    lastChecked: Date.now(),
    message: "",
  });
}

export async function markDataApiFailure(
  reason: string | undefined,
  status: number | undefined,
  message: string
): Promise<DataApiHealth> {
  const normalized = (reason || "").toLowerCase();
  let state: DataApiHealthState = "invalid";
  let pause = HOUR;

  if (normalized.includes("quota") || normalized.includes("dailylimit")) {
    state = "quota_exceeded";
    pause = 24 * HOUR;
  } else if (
    normalized.includes("ratelimit") ||
    normalized.includes("rate_limit") ||
    status === 429
  ) {
    state = "rate_limited";
    pause = 15 * 60 * 1000;
  } else if (
    status === 401 ||
    normalized.includes("keyinvalid") ||
    normalized.includes("api_key")
  ) {
    state = "invalid";
    pause = 24 * HOUR;
  }

  return writeDataApiHealth({
    state,
    blockedUntil: Date.now() + pause,
    lastChecked: Date.now(),
    message,
  });
}

export async function isDataApiPaused(): Promise<boolean> {
  const health = await readDataApiHealth();
  return health.blockedUntil > Date.now();
}
