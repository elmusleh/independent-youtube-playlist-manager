export const LEGACY_SYNC_RECOVERY_NOTICE =
  "This device's previous sync format is unverified. The hosted v1 snapshot table is currently unavailable, and remote-only data may not be recoverable. Export a full JSON backup from every device that still has the old data before continuing. The app cannot confirm that any remote copy was recovered.";

type SyncCompatibilityConfig = {
  syncKey?: unknown;
  backends?: unknown;
  backend?: unknown;
  syncConfigVersion?: unknown;
  syncProtocolVersion?: unknown;
  legacyV2AcknowledgedAt?: unknown;
};

const REMOTE_BACKENDS = new Set(["relay", "supabase-byo"]);

/**
 * Fail closed for a configured remote space whose relay protocol has not been
 * verified as v2 and for which the user has not explicitly acknowledged recovery risk.
 */
export function needsV2RelayAcknowledgement(config: SyncCompatibilityConfig): boolean {
  if (typeof config.syncKey !== "string" || config.syncKey.trim().length === 0) return false;
  if (config.syncProtocolVersion === 2) return false;
  if (
    typeof config.legacyV2AcknowledgedAt === "number" &&
    Number.isSafeInteger(config.legacyV2AcknowledgedAt) &&
    config.legacyV2AcknowledgedAt > 0
  ) {
    return false;
  }

  const backends = Array.isArray(config.backends)
    ? config.backends
    : typeof config.backend === "string"
      ? [config.backend]
      : [];
  return backends.some((backend) => typeof backend === "string" && REMOTE_BACKENDS.has(backend));
}
