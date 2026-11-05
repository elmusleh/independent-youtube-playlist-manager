/**
 * Video array equality and 3-way add/remove merge helpers for playlists.
 *
 * Supports both IYPM's runtime `string[]` video ID arrays and rich `PlaylistVideo[]`
 * objects used in unit fixtures, preserving the input representation on output.
 */

export type PlaylistVideo = {
  videoId: string;
  title?: string;
  channelName?: string;
  duration?: number;
  position?: number;
  addedAt?: number;
  [key: string]: unknown;
};

export type VideoEntry = string | PlaylistVideo;

function isStringVideoList(local: VideoEntry[], remote: VideoEntry[], base: VideoEntry[]): boolean {
  const sample = [...local, ...remote, ...base];
  if (sample.length === 0) return true;
  return sample.every((v) => typeof v === "string");
}

export function getEntryVideoId(entry: VideoEntry): string {
  return typeof entry === "string" ? entry : entry.videoId;
}

export function playlistVideosEqual(a: VideoEntry[] = [], b: VideoEntry[] = []): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    if (typeof va === "string" || typeof vb === "string") {
      if (getEntryVideoId(va) !== getEntryVideoId(vb)) return false;
    } else {
      if (va.videoId !== vb.videoId) return false;
      if (va.position !== vb.position) return false;
    }
  }
  return true;
}

function mergeStringVideos(
  local: string[],
  remote: string[],
  base: string[],
  preferRemoteOrder: boolean
): string[] {
  const baseSet = new Set(base);
  const localSet = new Set(local);
  const remoteSet = new Set(remote);

  const removed = new Set<string>();
  for (const id of baseSet) {
    if (!localSet.has(id) || !remoteSet.has(id)) {
      removed.add(id);
    }
  }

  const primary = preferRemoteOrder ? remote : local;
  const secondary = preferRemoteOrder ? local : remote;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of primary) {
    if (typeof id !== "string" || !id || removed.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  for (const id of secondary) {
    if (typeof id !== "string" || !id || removed.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function mergeObjectVideos(
  local: PlaylistVideo[],
  remote: PlaylistVideo[],
  base: PlaylistVideo[]
): PlaylistVideo[] {
  const videoMap = new Map<string, PlaylistVideo>();
  const localMap = new Map(local.map((v) => [v.videoId, v]));
  const remoteMap = new Map(remote.map((v) => [v.videoId, v]));
  const baseMap = new Map(base.map((v) => [v.videoId, v]));

  const allVideoIds = new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()]);

  for (const videoId of allVideoIds) {
    const l = localMap.get(videoId) ?? null;
    const r = remoteMap.get(videoId) ?? null;
    const b = baseMap.get(videoId) ?? null;

    if (!b && l && r) {
      videoMap.set(videoId, l);
      continue;
    }
    if (!b && l && !r) {
      videoMap.set(videoId, l);
      continue;
    }
    if (!b && !l && r) {
      videoMap.set(videoId, r);
      continue;
    }
    if (b) {
      if (!l || !r) continue;
      const mergedVideo: PlaylistVideo = { ...l };
      if (l.position !== r.position) {
        const lTime = l.addedAt || 0;
        const rTime = r.addedAt || 0;
        if (rTime > lTime) mergedVideo.position = r.position;
      }
      if (l.title !== r.title || l.channelName !== r.channelName) {
        const lTime = l.addedAt || 0;
        const rTime = r.addedAt || 0;
        if (rTime > lTime) {
          mergedVideo.title = r.title;
          mergedVideo.channelName = r.channelName;
        }
      }
      videoMap.set(videoId, mergedVideo);
    }
  }

  return [...videoMap.values()].sort((a, b) => {
    const posA = a.position ?? Number.MAX_SAFE_INTEGER;
    const posB = b.position ?? Number.MAX_SAFE_INTEGER;
    if (posA !== posB) return posA - posB;
    return (a.addedAt || 0) - (b.addedAt || 0);
  });
}

export function mergeVideoArrays(
  local: VideoEntry[],
  remote: VideoEntry[],
  base: VideoEntry[],
  preferRemoteOrder = false
): VideoEntry[] {
  if (isStringVideoList(local, remote, base)) {
    return mergeStringVideos(
      local as string[],
      remote as string[],
      base as string[],
      preferRemoteOrder
    );
  }
  const toObj = (v: VideoEntry): PlaylistVideo => (typeof v === "string" ? { videoId: v } : v);
  return mergeObjectVideos(local.map(toObj), remote.map(toObj), base.map(toObj));
}
