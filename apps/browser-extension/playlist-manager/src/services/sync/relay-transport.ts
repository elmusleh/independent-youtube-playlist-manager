/**
 * Relay v2 transport — plain `fetch` RPC client.
 *
 * Talks only to the Postgres RPC functions defined in `docs/sync-relay-v2.sql`.
 * No direct table access, so relay rows cannot be enumerated by clients.
 * Works in the service worker, event pages and the editor page.
 */

export type RelayConfig = {
  url: string; // Supabase project URL
  anonKey: string; // Supabase anon/public key
};

export type RelayRecord = {
  collection: string;
  rid: string;
  version: number;
  payload: string; // base64 ciphertext
  deleted: boolean;
};

export type PushResult = {
  collection: string;
  rid: string;
  status: "ok" | "conflict" | "error";
  currentVersion?: number | null;
  message?: string;
};

export type PullResult = {
  records: Array<{
    collection: string;
    rid: string;
    version: number;
    seq: number;
    payload: string;
    deleted: boolean;
    updatedAt: string;
  }>;
};

const BATCH_SIZE = 50;

function rpcUrl(config: RelayConfig, fn: string): string {
  return `${config.url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`;
}

async function rpc<T>(config: RelayConfig, fn: string, body: unknown): Promise<T> {
  const res = await fetch(rpcUrl(config, fn), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`relay ${fn} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export async function claimSpace(
  config: RelayConfig,
  space: string,
  authHash: string
): Promise<boolean> {
  return rpc<boolean>(config, "sync_claim", { p_space: space, p_auth_hash: authHash });
}

export async function pullSince(
  config: RelayConfig,
  space: string,
  authHash: string,
  sinceSeq: number = 0,
  limit: number = 200
): Promise<PullResult["records"]> {
  const rows = await rpc<
    Array<{
      collection: string;
      rid: string;
      version: number;
      seq: number;
      payload: string;
      deleted: boolean;
      updated_at: string;
    }>
  >(config, "sync_pull", {
    p_space: space,
    p_auth_hash: authHash,
    p_since_seq: sinceSeq,
    p_limit: limit,
  });
  return rows.map((r) => ({
    collection: r.collection,
    rid: r.rid,
    version: r.version,
    seq: r.seq,
    payload: r.payload,
    deleted: r.deleted,
    updatedAt: r.updated_at,
  }));
}

export async function pushBatch(
  config: RelayConfig,
  space: string,
  authHash: string,
  records: RelayRecord[]
): Promise<PushResult[]> {
  const payload = records.map((r) => ({
    collection: r.collection,
    rid: r.rid,
    version: r.version,
    payload: r.payload,
    deleted: r.deleted,
  }));
  const res = await rpc<
    Array<{
      collection: string;
      rid: string;
      status: string;
      current_version?: number | null;
      message?: string;
    }>
  >(config, "sync_push", { p_space: space, p_auth_hash: authHash, p_records: payload });
  return res.map((r) => ({
    collection: r.collection,
    rid: r.rid,
    status: (r.status as PushResult["status"]) ?? "error",
    currentVersion: r.current_version ?? null,
    message: r.message,
  }));
}

export async function pushAll(
  config: RelayConfig,
  space: string,
  authHash: string,
  records: RelayRecord[],
  onProgress?: (done: number, total: number) => void
): Promise<PushResult[]> {
  // Client-side guard: reject oversized payloads before sending (M4).
  for (const r of records) {
    if (r.payload.length > 150_000) {
      throw new Error(`Payload too large: ${r.payload.length} bytes (max 150000)`);
    }
  }
  const results: PushResult[] = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const r = await pushBatch(config, space, authHash, batch);
    results.push(...r);
    onProgress?.(Math.min(i + batch.length, records.length), records.length);
  }
  return results;
}

export async function pullAll(
  config: RelayConfig,
  space: string,
  authHash: string,
  sinceSeq: number = 0,
  onProgress?: (done: number) => void
): Promise<PullResult["records"]> {
  const all: PullResult["records"] = [];
  let cursor = sinceSeq;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await pullSince(config, space, authHash, cursor, 200);
    all.push(...batch);
    onProgress?.(all.length);
    if (batch.length < 200) break;
    cursor = batch[batch.length - 1].seq;
  }
  return all;
}

export async function deleteSpace(
  config: RelayConfig,
  space: string,
  authHash: string
): Promise<boolean> {
  return rpc<boolean>(config, "sync_delete_space", { p_space: space, p_auth_hash: authHash });
}
