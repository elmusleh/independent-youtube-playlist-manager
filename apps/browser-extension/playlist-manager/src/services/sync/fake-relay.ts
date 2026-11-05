/**
 * In-memory implementation of the relay v2 contract, for tests.
 * Mirrors docs/sync-relay-v2.sql semantics: claim, pull since seq, push with
 * version conflict detection, delete space.
 */

import type { RelayConfig, RelayRecord, PushResult } from "./relay-transport";

export type FakeRelayState = {
  spaces: Map<string, { authHash: string }>;
  records: Map<
    string,
    {
      space: string;
      collection: string;
      rid: string;
      version: number;
      seq: number;
      payload: string;
      deleted: boolean;
    }
  >;
  seqCounter: number;
};

export function createFakeRelay() {
  const state: FakeRelayState = {
    spaces: new Map(),
    records: new Map(),
    seqCounter: 0,
  };

  function key(space: string, collection: string, rid: string): string {
    return `${space}|${collection}|${rid}`;
  }

  return {
    state,
    async claimSpace(space: string, authHash: string): Promise<boolean> {
      const existing = state.spaces.get(space);
      if (existing && existing.authHash !== authHash) return false;
      if (!existing) state.spaces.set(space, { authHash });
      return true;
    },
    async pullSince(
      space: string,
      authHash: string,
      sinceSeq: number = 0,
      limit: number = 200
    ): Promise<
      Array<{
        collection: string;
        rid: string;
        version: number;
        seq: number;
        payload: string;
        deleted: boolean;
        updatedAt: string;
      }>
    > {
      const sp = state.spaces.get(space);
      if (!sp || sp.authHash !== authHash) throw new Error("unauthorized");
      const rows = [...state.records.values()]
        .filter((r) => r.space === space && r.seq > sinceSeq)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit);
      return rows.map((r) => ({
        collection: r.collection,
        rid: r.rid,
        version: r.version,
        seq: r.seq,
        payload: r.payload,
        deleted: r.deleted,
        updatedAt: new Date().toISOString(),
      }));
    },
    async pushBatch(
      space: string,
      authHash: string,
      records: RelayRecord[]
    ): Promise<PushResult[]> {
      const sp = state.spaces.get(space);
      if (!sp || sp.authHash !== authHash) throw new Error("unauthorized");
      const results: PushResult[] = [];
      for (const rec of records) {
        const k = key(space, rec.collection, rec.rid);
        const existing = state.records.get(k);
        const curVersion = existing?.version ?? null;
        if (curVersion === null) {
          state.seqCounter += 1;
          state.records.set(k, {
            space,
            collection: rec.collection,
            rid: rec.rid,
            version: rec.version,
            seq: state.seqCounter,
            payload: rec.payload,
            deleted: rec.deleted,
          });
          results.push({
            collection: rec.collection,
            rid: rec.rid,
            status: "ok",
            currentVersion: null,
          });
        } else if (rec.version > curVersion) {
          state.seqCounter += 1;
          state.records.set(k, {
            space,
            collection: rec.collection,
            rid: rec.rid,
            version: rec.version,
            seq: state.seqCounter,
            payload: rec.payload,
            deleted: rec.deleted,
          });
          results.push({
            collection: rec.collection,
            rid: rec.rid,
            status: "ok",
            currentVersion: curVersion,
          });
        } else {
          results.push({
            collection: rec.collection,
            rid: rec.rid,
            status: "conflict",
            currentVersion: curVersion,
          });
        }
      }
      return results;
    },
    async deleteSpace(space: string, authHash: string): Promise<boolean> {
      const sp = state.spaces.get(space);
      if (!sp || sp.authHash !== authHash) return false;
      state.spaces.delete(space);
      for (const [k, v] of [...state.records.entries()]) {
        if (v.space === space) state.records.delete(k);
      }
      return true;
    },
  };
}
