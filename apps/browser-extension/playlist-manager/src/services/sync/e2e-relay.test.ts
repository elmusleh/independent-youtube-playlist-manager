/// <reference types="node" />
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
 *   docker exec iypm-audit-pg psql -U postgres -c "create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;"
 *   docker exec iypm-audit-pg psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/relay.sql
 *   docker run -d --name iypm-audit-rest --network iypm-audit-net -p 127.0.0.1:3311:3000 \
 *     -e PGRST_DB_URI="postgres://postgres:audit@iypm-audit-pg:5432/postgres" \
 *     -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
 *     -e PGRST_JWT_SECRET="audit-local-jwt-secret-0123456789abcdef0123456789" postgrest/postgrest:latest
 *
 * Run: npm run test:sync:relay (after starting the fixture above)
 *
 * This file is excluded from the default unit suite and is run only with the
 * local Postgres/PostgREST fixture or an explicitly configured compatible test server.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import * as rt from "./relay-transport";

const PG = process.env.IYPM_RELAY_URL ?? "http://127.0.0.1:3312";
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
let testClientIp = "198.18.0.1";

beforeEach(() => {
  testClientIp = `198.18.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`;
});

beforeAll(async () => {
  const res = await realFetch(`${PG}/`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Relay E2E backend is unavailable: ${PG} returned ${res.status}`);
  vi.stubGlobal("fetch", (input: any, init: any = {}) => {
    const headers = new Headers(init.headers);
    headers.set("X-Forwarded-For", testClientIp);
    return realFetch(String(input).replace("https://fake.supabase.test/rest/v1/", PG + "/"), {
      ...init,
      headers,
    });
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const hex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const newSpace = () => ({ space: hex(64), auth: hex(64) });
const directRpc = (fn: string, body: unknown) =>
  realFetch(`${PG}/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: JWT,
      Authorization: `Bearer ${JWT}`,
      "X-Forwarded-For": testClientIp,
    },
    body: JSON.stringify(body),
  });

const directTable = (table: string) =>
  realFetch(`${PG}/${table}?select=*`, {
    headers: {
      apikey: JWT,
      Authorization: `Bearer ${JWT}`,
    },
  });

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

  it("does not expose relay tables through direct REST access", async () => {
    const { space, auth } = newSpace();
    expect(await rt.claimSpace(CFG, space, auth)).toBe(true);

    const responses = await Promise.all(
      ["sync_spaces", "sync_records", "sync_rate_limit"].map(directTable)
    );
    for (const response of responses) {
      expect([401, 403]).toContain(response.status);
    }
  });

  it("limits sync RPC traffic per gateway client IP across distinct spaces", async () => {
    const spaces = Array.from({ length: 3 }, newSpace);
    for (const { space, auth } of spaces) {
      expect(await rt.claimSpace(CFG, space, auth)).toBe(true);
    }

    for (let attempt = 0; attempt < 247; attempt++) {
      const { space, auth } = spaces[attempt % spaces.length];
      const response = await directRpc("sync_pull", {
        p_space: space,
        p_auth_hash: auth,
        p_since_seq: 0,
        p_limit: 1,
      });
      expect(response.ok).toBe(true);
    }

    const { space, auth } = spaces[0];
    const throttled = await directRpc("sync_pull", {
      p_space: space,
      p_auth_hash: auth,
      p_since_seq: 0,
      p_limit: 1,
    });
    expect(throttled.status, await throttled.text()).toBe(429);
  });

  it("fails closed when the gateway client IP is unavailable", async () => {
    const { space, auth } = newSpace();
    const response = await realFetch(`${PG}/rpc/sync_claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: JWT,
        Authorization: `Bearer ${JWT}`,
      },
      body: JSON.stringify({ p_space: space, p_auth_hash: auth }),
    });
    expect(response.status).toBe(403);
    expect(await response.text()).toMatch(/gateway-verified client IP/i);
  });

  it("invalid auth attempts do not consume the valid space rate limit", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    for (let attempt = 0; attempt < 101; attempt++) {
      const response = await directRpc("sync_pull", {
        p_space: space,
        p_auth_hash: hex(64),
        p_since_seq: 0,
        p_limit: 1,
      });
      expect(response.ok).toBe(false);
      expect(await response.text()).toMatch(/unauthorized/);
    }
    expect(await rt.pullAll(CFG, space, auth, 0)).toEqual([]);
  });

  it("returns malformed records as per-record errors without rolling back valid peers", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const validRid = hex(32);
    const response = await directRpc("sync_push", {
      p_space: space,
      p_auth_hash: auth,
      p_records: [
        {
          collection: "settings",
          rid: hex(32),
          version: "not-a-number",
          payload: "bad",
          deleted: false,
        },
        {
          collection: "settings",
          rid: validRid,
          version: 100,
          payload: "valid-peer",
          deleted: false,
        },
      ],
    });
    expect(response.ok).toBe(true);
    const results = (await response.json()) as Array<{ status: string; message?: string }>;
    expect(results.map((result) => result.status)).toEqual(["error", "ok"]);
    expect(results[0].message).toBe("invalid version");
    expect((await rt.pullAll(CFG, space, auth, 0)).map((record) => record.rid)).toContain(validRid);
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

  it("relay rejects far-future versions even when the client guard is bypassed", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const rid = hex(32);
    const futureVersion = Date.now() + 25 * 60 * 60 * 1000;
    const response = await directRpc("sync_push", {
      p_space: space,
      p_auth_hash: auth,
      p_records: [
        { collection: "settings", rid, version: futureVersion, payload: "too-far", deleted: false },
      ],
    });
    expect(response.ok).toBe(true);
    const [result] = (await response.json()) as Array<{ status: string; message: string }>;
    expect(result).toMatchObject({ status: "error", message: "version too far in future" });
    expect(await rt.pullAll(CFG, space, auth, 0)).toEqual([]);
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

  it("conflict resolution: newer version wins (LWW)", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const rid = hex(32);
    // Device A pushes v1
    await rt.pushAll(CFG, space, auth, [
      {
        collection: "playlists",
        rid,
        version: 100,
        payload: JSON.stringify({ name: "v1" }),
        deleted: false,
      },
    ]);
    // Device B pushes v2 (higher version) — overwrites
    await rt.pushAll(CFG, space, auth, [
      {
        collection: "playlists",
        rid,
        version: 200,
        payload: JSON.stringify({ name: "v2" }),
        deleted: false,
      },
    ]);
    // Pull should return v2
    const pulled = await rt.pullAll(CFG, space, auth, 0);
    expect(pulled.length).toBe(1);
    expect(JSON.parse(pulled[0].payload).name).toBe("v2");
  });

  it("conflict resolution: older version is rejected", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const rid = hex(32);
    // Push v2 first
    await rt.pushAll(CFG, space, auth, [
      {
        collection: "playlists",
        rid,
        version: 200,
        payload: JSON.stringify({ name: "v2" }),
        deleted: false,
      },
    ]);
    // Try to push v1 (older) — should be rejected or ignored
    const res = await rt.pushAll(CFG, space, auth, [
      {
        collection: "playlists",
        rid,
        version: 100,
        payload: JSON.stringify({ name: "v1" }),
        deleted: false,
      },
    ]);
    // The older version should not overwrite
    const pulled = await rt.pullAll(CFG, space, auth, 0);
    expect(JSON.parse(pulled[0].payload).name).toBe("v2");
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

  it("limits new-space claims globally so unique IDs cannot bypass the per-space guard", async () => {
    const reset = await directRpc("test_reset_sync_rate_limit", {});
    expect(reset.ok).toBe(true);

    let allowed = 0;
    let throttled = false;
    try {
      for (let attempt = 0; attempt <= 100; attempt++) {
        const response = await directRpc("sync_claim", {
          p_space: hex(64),
          p_auth_hash: hex(64),
        });
        if (response.ok) {
          allowed++;
          expect(await response.json()).toBe(true);
          continue;
        }
        expect(await response.text()).toMatch(/rate limit exceeded/);
        throttled = true;
        break;
      }
      expect(allowed).toBe(100);
      expect(throttled).toBe(true);
    } finally {
      await directRpc("test_reset_sync_rate_limit", {});
    }
  });

  it("enforces the valid per-space request limit", async () => {
    const reset = await directRpc("test_reset_sync_rate_limit", {});
    expect(reset.ok).toBe(true);
    const space = hex(64);
    const auth = hex(64);

    try {
      const claim = await directRpc("sync_claim", { p_space: space, p_auth_hash: auth });
      expect(claim.ok).toBe(true);

      let allowed = 0;
      let throttled = false;
      for (let attempt = 0; attempt <= 100; attempt++) {
        const response = await directRpc("sync_pull", {
          p_space: space,
          p_auth_hash: auth,
          p_since_seq: 0,
          p_limit: 1,
        });
        if (response.ok) {
          allowed++;
          continue;
        }
        expect(await response.text()).toMatch(/rate limit exceeded/);
        throttled = true;
        break;
      }
      expect(allowed).toBe(100);
      expect(throttled).toBe(true);
    } finally {
      await directRpc("test_reset_sync_rate_limit", {});
    }
  });

  it("preserves the highest version during concurrent first writes", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    const rid = hex(32);
    const versions = Array.from({ length: 24 }, (_, index) => Date.now() + index);

    const responses = await Promise.all(
      versions.map((version) =>
        directRpc("sync_push", {
          p_space: space,
          p_auth_hash: auth,
          p_records: [
            {
              collection: "playlists",
              rid,
              version,
              payload: JSON.stringify({ version }),
              deleted: false,
            },
          ],
        })
      )
    );

    const results = await Promise.all(responses.map((response) => response.json()));
    expect(
      results
        .flat()
        .every((result: { status: string }) => ["ok", "conflict"].includes(result.status))
    ).toBe(true);
    const stored = await rt.pullAll(CFG, space, auth, 0);
    const winner = stored.find((record) => record.rid === rid);
    expect(Number(winner?.version)).toBe(Math.max(...versions));
  });
});
