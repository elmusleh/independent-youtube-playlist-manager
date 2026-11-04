/**
 * Sync performance benchmark.
 *
 * Measures sync throughput for 100/1000/10000 records against a
 * live Postgres + PostgREST backend.
 *
 * Run: npx tsx scripts/bench-sync.ts
 * (requires backend running on 127.0.0.1:3311)
 */
import { performance } from "node:perf_hooks";

const PG = "http://127.0.0.1:3311";
const JWT_SECRET = "audit-local-jwt-secret-0123456789abcdef0123456789";

function makeJwt(): string {
  const crypto = require("node:crypto");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ role: "anon", exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const JWT = makeJwt();
const hex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

async function bench(n: number) {
  const space = hex(64);
  const auth = hex(64);

  // Claim
  await fetch(`${PG}/rpc/sync_claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${JWT}` },
    body: JSON.stringify({ p_space: space, p_auth_hash: auth }),
  });

  // Push n records
  const records = Array.from({ length: n }, (_, i) => ({
    collection: "playlists",
    rid: hex(32),
    version: 1000 + i,
    payload: JSON.stringify({ name: `playlist-${i}` }),
    deleted: false,
  }));

  const t0 = performance.now();
  await fetch(`${PG}/rpc/sync_push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${JWT}` },
    body: JSON.stringify({ p_space: space, p_auth_hash: auth, p_records: records }),
  });
  const pushMs = performance.now() - t0;

  // Pull all
  const t1 = performance.now();
  await fetch(`${PG}/rpc/sync_pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${JWT}` },
    body: JSON.stringify({ p_space: space, p_auth_hash: auth, p_since_seq: 0, p_limit: 10000 }),
  });
  const pullMs = performance.now() - t1;

  console.log(
    `n=${n}: push=${pushMs.toFixed(1)}ms (${(n / (pushMs / 1000)).toFixed(0)} rec/s), pull=${pullMs.toFixed(1)}ms (${(n / (pullMs / 1000)).toFixed(0)} rec/s)`
  );
}

async function main() {
  for (const n of [100, 1000, 10000]) {
    await bench(n);
  }
}

main().catch(console.error);
