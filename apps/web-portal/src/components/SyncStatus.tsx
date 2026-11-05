"use client";
export function SyncStatus({ status, lastSynced, isLoading, onSync }: { status?: string; lastSynced?: Date | null; isLoading?: boolean; onSync?: () => Promise<void> }) {
  return (
    <div className="text-sm text-muted-foreground">
      <span>{status ?? "Idle"}</span>
      {lastSynced && <span className="ml-2">Last synced: {lastSynced.toLocaleString()}</span>}
      {onSync && (
        <button onClick={onSync} disabled={isLoading} className="ml-2 text-primary">
          {isLoading ? "Syncing..." : "Sync"}
        </button>
      )}
    </div>
  );
}
