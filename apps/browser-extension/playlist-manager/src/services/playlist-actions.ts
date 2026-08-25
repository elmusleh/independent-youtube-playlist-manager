import { requestConfirm } from "../stores/confirmation";
import { logger } from "./logger";
import type { Playlist } from "../types/model";
import type { SyncState } from "./sync-state-service";

export interface CardAction {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface SyncablePlaylist {
  id: string;
  title?: string;
  videos?: { videoId: string }[];
  isTagged?: boolean;
  isLocal?: boolean;
  category?: string;
}

export function createCardActions(p: {
  id: string;
  isTagged: boolean;
  isLocal: boolean;
  category?: string;
  signedIn: boolean;
  adoptingId: string;
  syncingId: string;
  openInEditor: (p: { id: string }) => void;
  requestAdopt: (p: { id: string }) => void;
  requestSync: (p: SyncablePlaylist) => void;
}): CardAction[] {
  const actions: CardAction[] = [
    {
      label: "Open",
      icon: "faArrowUpRightFromSquare",
      onClick: () => p.openInEditor(p),
    },
  ];

  if (p.category === "liked" || p.category === "uploaded") {
    actions.push({
      label: "Open in YouTube",
      icon: "faYoutube",
      onClick: () => {
        const listId = p.id === "UPLOADS" ? "UU" : p.id;
        window.open(`https://www.youtube.com/playlist?list=${listId}`, "_blank");
      },
    });
  }

  if (
    !p.isTagged &&
    !p.isLocal &&
    p.signedIn &&
    !["LIKED", "UPLOADS"].includes(p.id) &&
    !(p.category === "liked" || p.category === "uploaded")
  ) {
    actions.push({
      label: p.adoptingId === p.id ? "Adopting…" : "Adopt",
      onClick: () => p.requestAdopt(p),
      disabled: p.adoptingId === p.id,
    });
  }

  if (p.isLocal && p.signedIn) {
    actions.push({
      label: p.syncingId === p.id ? "Syncing…" : "Sync",
      onClick: () => p.requestSync(p),
      disabled: p.syncingId === p.id,
    });
  }

  return actions;
}

export function requestAdoptConfirm(p: { id: string }, onConfirm: () => void) {
  requestConfirm({
    title: "Adopt Playlist?",
    message: "This will add this YouTube playlist to your local management.",
    color: "primary",
    onConfirm,
  });
}

export async function adoptPlaylist(p: { id: string }): Promise<void> {
  try {
    await window.adoptPlaylist(p.id);
  } catch (e) {
    logger.error("Failed to adopt playlist", e);
    window.error("Failed to adopt playlist");
  }
}

export async function requestSyncConfirm(
  p: SyncablePlaylist,
  localPlaylists: Playlist[],
  onSync: (resumeState: SyncState | null) => void
) {
  const localP = localPlaylists.find((lp) => lp.id === p.id);
  if (!localP) return;

  const existingSync = await window.getSyncState(p.id);

  if (existingSync?.remotePlaylistId) {
    try {
      const remoteExists = await window.ytGetPlaylist(existingSync.remotePlaylistId);
      if (remoteExists) {
        const synced = existingSync.syncedVideoIds.length;
        const total = existingSync.totalVideos;
        const remaining = existingSync.remainingVideoIds.length;
        const isAutoRetry = await window.isAutoRetryScheduled(p.id);

        requestConfirm({
          title: "Resume Existing Sync?",
          message:
            `Found partially synced playlist "${localP.title}" with ${synced}/${total} videos (${remaining} remaining).\n\n` +
            `Auto-retry scheduled: ${isAutoRetry ? "Yes (24h)" : "No"}\n\n` +
            `Do you want to resume syncing, or start fresh with a new playlist?`,
          color: "primary",
          confirmLabel: "Resume Sync",
          cancelLabel: "Start Fresh",
          onConfirm: () => onSync(existingSync),
          onCancel: async () => {
            const stillScheduled = await window.isAutoRetryScheduled(p.id);
            if (stillScheduled) {
              await window.cancelAutoRetry(p.id);
            }
            await window.clearSyncState(p.id);
            onSync(null);
          },
        });
        return;
      }
    } catch {
      await window.clearSyncState(p.id);
    }
  }

  requestConfirm({
    title: "Sync to YouTube?",
    message:
      `This will create a new playlist on your YouTube account with ${localP.videos.length} videos.\n\n` +
      `Note: Large playlists may take multiple days to sync due to API quota limits (~200 videos/day).`,
    color: "primary",
    onConfirm: () => onSync(null),
  });
}

export async function syncPlaylist(
  p: { id: string },
  resumeState: SyncState | null,
  localPlaylists: Playlist[]
): Promise<boolean> {
  const localP = localPlaylists.find((lp) => lp.id === p.id);
  if (!localP) return false;

  try {
    await window.savePlaylist(localP, {
      syncToYoutube: true,
      resumeFromState: resumeState || undefined,
    });

    const isComplete = await window.isSyncComplete(p.id);
    if (isComplete) {
      window.success("Playlist synced to YouTube successfully!");
    } else {
      const syncState = await window.getSyncState(p.id);
      if (syncState) {
        const synced = syncState.syncedVideoIds.length;
        const total = syncState.totalVideos;
        const isAutoRetry = await window.isAutoRetryScheduled(p.id);
        window.info(
          `Partial sync: ${synced}/${total} videos uploaded. ` +
            `${isAutoRetry ? "Will auto-resume in 24h." : "Click Sync to continue."}`
        );
      }
    }
    return true;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logger.error("Failed to sync playlist:", e);

    if (
      errorMsg.toLowerCase().includes("quota") ||
      errorMsg.toLowerCase().includes("ratelimitexceeded")
    ) {
      const syncState = await window.getSyncState(p.id);
      if (syncState) {
        const synced = syncState?.syncedVideoIds?.length ?? 0;
        const total = syncState?.totalVideos ?? localP?.videos?.length ?? 0;
        const remaining = syncState?.remainingVideoIds?.length ?? 0;
        const daysNeeded = total > 0 ? Math.ceil(remaining / 200) : 0;
        const isAutoRetry = await window.isAutoRetryScheduled(p.id);
        window.error(
          `API quota exceeded!\n\n` +
            `Progress: ${synced}/${total} videos synced\n` +
            `Remaining: ${remaining} videos\n` +
            `Estimated completion: ${daysNeeded} day${daysNeeded > 1 ? "s" : ""}\n\n` +
            `${isAutoRetry ? "✓ Auto-retry scheduled in 24h" : "Click Sync to resume tomorrow"}`
        );
      } else {
        window.error("API quota exceeded. Please try again tomorrow.");
      }
    } else {
      window.error("Failed to sync playlist: " + errorMsg);
    }
    return false;
  }
}
