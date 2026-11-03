/**
 * Playlists collection adapter for the sync engine.
 *
 * Bridges the local library (via mutateLibrary / librarySnapshot) and the
 * shadow store with the relay transport. Each playlist is its own record.
 */

import { mergePlaylists } from "../merge/playlists";
import { getShadow, setShadow, computeHash, isDirty } from "../shadow-store";
import type { RelayRecord } from "../relay-transport";
import { deriveKeys, computeRecordId, computeStorageAddress, computeAuthToken } from "../keys";

export type PlaylistRecordData = {
  id: string;
  title: string;
  videos: string[];
  [key: string]: unknown;
};

export type AdapterContext = {
  syncKey: string;
  space: string;
  authHash: string;
  relayConfig: { url: string; anonKey: string };
  localDeviceId: string;
  // injected by the engine
  librarySnapshot: () => Promise<{ playlists: any[]; revision: number }>;
  mutateLibrary: (op: any) => Promise<any>;
};

export async function collectDirtyPlaylists(ctx: AdapterContext): Promise<RelayRecord[]> {
  const { playlists } = await ctx.librarySnapshot();
  const derived = await deriveKeys(ctx.syncKey);
  void derived;
  const dirty: RelayRecord[] = [];
  for (const p of playlists) {
    if (await isDirty("playlists", p.id, p)) {
      const rid = await computeRecordId(ctx.syncKey, "playlists", p.id);
      dirty.push({
        collection: "playlists",
        rid,
        version: (p.updatedAt as number) || Date.now(),
        payload: JSON.stringify(p),
        deleted: false,
      });
    }
  }
  return dirty;
}

export async function applyRemotePlaylists(
  ctx: AdapterContext,
  remote: Array<{ rid: string; payload: string; deleted: boolean; version: number }>
): Promise<{ applied: number; failed: string[] }> {
  const { playlists: local } = await ctx.librarySnapshot();
  const baseCopies = new Map<string, any>();
  for (const p of local) {
    const base = await getShadow("playlists", p.id);
    if (base?.baseCopy) baseCopies.set(p.id, base.baseCopy);
  }

  const remotePlaylists = remote
    .filter((r) => !r.deleted)
    .map((r) => {
      try {
        return JSON.parse(r.payload);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const base = [...baseCopies.values()];
  const { merged } = mergePlaylists(local, remotePlaylists, base);

  const failed: string[] = [];
  try {
    await ctx.mutateLibrary({
      type: "replace",
      playlists: merged,
      expectedRevision: (await ctx.librarySnapshot()).revision,
    });
  } catch (e) {
    failed.push(`playlists: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Update shadow store for merged records.
  for (const p of merged) {
    await setShadow("playlists", p.id, p, (p.updatedAt as number) || Date.now(), ctx.localDeviceId);
  }

  return { applied: merged.length, failed };
}

export { computeStorageAddress, computeAuthToken };
