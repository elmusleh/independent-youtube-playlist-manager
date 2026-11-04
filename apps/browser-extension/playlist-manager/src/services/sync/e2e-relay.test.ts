/**
 * @vitest-environment node
 *
 * E2E: real relay-transport.ts client against real Postgres 16 + PostgREST.
 *
 * Requires a running backend:
 *   docker network create iypm-audit-net
 *   docker run -d --name iypm-audit-pg --network iypm-audit-net \
 *     -e POSTGRES_PASSWORD=audit -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
 *   docker cp docs/sync-relay-v2.sql iypm-audit-pg:/tmp/relay.sql
 *   docker exec iypm-audit-pg psql -U postgres -c "create role anon nologin; grant usage on schema public to anon;"
 *   docker exec iypm-audit-pg psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/relay.sql
 *   docker run -d --name iypm-audit-rest --network iypm-audit-net -p 127.0.0.1:3311:3000 \
 *     -e PGRST_DB_URI="postgres://postgres:audit@iypm-audit-pg:5432/postgres" \
 *     -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
 *     -e PGRST_JWT_SECRET="audit-local-jwt-secret-0123456789abcdef0123456789" postgrest/postgrest:latest
 *
 * Run: npx vitest run --config vitest.config.mjs src/services/sync/e2e-relay.test.ts
 *
 * Skips automatically when the backend is not reachable.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import * as rt from "./relay-transport";

const PG = "http://127.0.0.1:3311";
const JWT_SECRET = "audit-local-jwt-secret-0123456789abcdef0123456789";

function makeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ role: "anon", exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const JWT = makeJwt();
const CFG = { url: "https://fake.supabase.test", anonKey: JWT };

const realFetch = globalThis.fetch;
let backendAvailable = false;

beforeAll(async () => {
  try {
    const res = await realFetch(`${PG}/`, { signal: AbortSignal.timeout(3000) });
    backendAvailable = res.ok;
    console.log("BACKEND_CHECK:", res.status, res.ok);
  } catch (e: any) {
    backendAvailable = false;
    console.log("BACKEND_ERROR:", e.message);
  }
  if (backendAvailable) {
    vi.stubGlobal("fetch", (input: any, init?: any) =>
      realFetch(String(input).replace("https://fake.supabase.test/rest/v1/", PG + "/"), init)
    );
  }
});

afterAll(() => {
  if (backendAvailable) vi.unstubAllGlobals();
});

const hex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const newSpace = () => ({ space: hex(64), auth: hex(64) });

describe("E2E: real client + real SQL", () => {
  it("claim -> push numeric version -> pull returns the record", async () => {
    const { space, auth } = newSpace();
    expect(await rt.claimSpace(CFG, space, auth)).toBe(true);
    const res = await rt.pushAll(CFG, space, auth, [
      {
        collection: "settings",
        rid: hex(32),
        version: 1700000000000,
        payload: "{}",
        deleted: false,
      },
    ]);
    expect(res[0].status).toBe("ok");
    expect((await rt.pullAll(CFG, space, auth, 0)).length).toBe(1);
  });

  it("wrong auth token is rejected", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    await expect(rt.pullAll(CFG, space, hex(64), 0)).rejects.toThrow(/unauthorized/);
  });

  it("BUG-3: cursor advances on record update", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const rid = hex(32);
    await rt.pushAll(CFG, space, auth, [
      { collection: "settings", rid, version: 100, payload: "A1", deleted: false },
    ]);
    const firstPull = await rt.pullAll(CFG, space, auth, 0);
    const cursor = Math.max(...firstPull.map((r: any) => r.seq));
    await rt.pushAll(CFG, space, auth, [
      { collection: "settings", rid, version: 200, payload: "A2", deleted: false },
    ]);
    const second = await rt.pullAll(CFG, space, auth, cursor);
    expect(second.map((r: any) => r.payload)).toContain("A2");
  });

  it("BUG-4: far-future version is rejected", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const rid = hex(32);
    // Far-future version should be rejected (client-side guard).
    await expect(
      rt.pushAll(CFG, space, auth, [
        {
          collection: "settings",
          rid,
          version: 9000000000000000,
          payload: "FUTURE",
          deleted: false,
        },
      ])
    ).rejects.toThrow();
    const honest = await rt.pushAll(CFG, space, auth, [
      { collection: "settings", rid, version: 1700000000000, payload: "HONEST", deleted: false },
    ]);
    // The honest push should succeed.
    expect(honest[0].status).toBe("ok");
  });

  it("second device: data created on device A is visible on device B", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const rid = hex(32);
    // Device A pushes a playlist
    await rt.pushAll(CFG, space, auth, [
      {
        collection: "playlists",
        rid,
        version: 100,
        payload: JSON.stringify({ name: "My Playlist" }),
        deleted: false,
      },
    ]);
    // Device B pulls (sinceSeq=0)
    const pulled = await rt.pullAll(CFG, space, auth, 0);
    expect(pulled.length).toBe(1);
    expect(JSON.parse(pulled[0].payload).name).toBe("My Playlist");
  });

  it("second device: edit on device B propagates back to device A", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const rid = hex(32);
    // Device A pushes
    await rt.pushAll(CFG, space, auth, [
      {
        collection: "playlists",
        rid,
        version: 100,
        payload: JSON.stringify({ name: "Original" }),
        deleted: false,
      },
    ]);
    const firstPull = await rt.pullAll(CFG, space, auth, 0);
    const cursor = Math.max(...firstPull.map((r: any) => r.seq));
    // Device B edits (new version, new seq)
    await rt.pushAll(CFG, space, auth, [
      {
        collection: "playlists",
        rid,
        version: 200,
        payload: JSON.stringify({ name: "Renamed" }),
        deleted: false,
      },
    ]);
    // Device A pulls since cursor
    const second = await rt.pullAll(CFG, space, auth, cursor);
    expect(second.length).toBe(1);
    expect(JSON.parse(second[0].payload).name).toBe("Renamed");
  });

  it("payload cap: 2MB payload is rejected", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const big = "X".repeat(2 * 1024 * 1024);
    await expect(
      rt.pushAll(CFG, space, auth, [
        { collection: "playlists", rid: hex(32), version: 1, payload: big, deleted: false },
      ])
    ).rejects.toThrow();
  });
});
