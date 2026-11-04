// E2E: REAL relay-transport.ts client  ->  REAL docs/sync-relay-v2.sql on Postgres 16
// (served by PostgREST). Only the URL prefix is rewritten (/rest/v1/ -> /), because
// local PostgREST does not mount under Supabase's /rest/v1 path.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as rt from "../relay-transport";

const PG = "http://127.0.0.1:3311";
// Local PostgREST requires a signed anon JWT (Supabase's gateway normally supplies it).
const JWT = "";
const CFG = { url: "https://fake.supabase.test", anonKey: JWT };
const realFetch = globalThis.fetch;

const hex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const newSpace = () => ({ space: hex(64), auth: hex(64) });

beforeAll(() => {
  vi.stubGlobal("fetch", (input: any, init?: any) =>
    realFetch(String(input).replace("https://fake.supabase.test/rest/v1/", PG + "/"), init)
  );
});
afterAll(() => vi.unstubAllGlobals());

describe.skip("control (must pass): real client + real SQL behave for numeric versions", () => {
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

  it("wrong auth token is rejected (space isolation holds)", async () => {
    const { space, auth } = newSpace();
    await rt.claimSpace(CFG, space, auth);
    await expect(rt.pullAll(CFG, space, hex(64), 0)).rejects.toThrow(/unauthorized/);
  });
});

describe.skip("KNOWN BUGS (it.fails: assertion = correct behaviour; passing here = bug reproduced)", () => {
  it.fails(
    "BUG-1 playlists with ISO-8601 updatedAt (the real adapter's version) can be pushed",
    async () => {
      const { space, auth } = newSpace();
      await rt.claimSpace(CFG, space, auth);
      const isoVersion = "2026-11-04T10:00:00.000Z"; // what adapters/playlists.ts sends
      try {
        const res = await rt.pushAll(CFG, space, auth, [
          {
            collection: "playlists",
            rid: hex(32),
            version: isoVersion as any,
            payload: "{}",
            deleted: false,
          },
        ]);
        console.log("EVIDENCE BUG-1 accepted:", JSON.stringify(res));
        expect(res[0].status).toBe("ok");
      } catch (e: any) {
        console.log("EVIDENCE BUG-1 rejected by real RPC:", String(e.message).slice(0, 200));
        throw e;
      }
    }
  );

  it.fails(
    "BUG-2 one malformed record must not block the good records batched with it",
    async () => {
      const { space, auth } = newSpace();
      await rt.claimSpace(CFG, space, auth);
      const goodRid = hex(32);
      await rt
        .pushAll(CFG, space, auth, [
          { collection: "settings", rid: goodRid, version: 5, payload: "good", deleted: false },
          {
            collection: "playlists",
            rid: hex(32),
            version: "2026-11-04T10:00:00.000Z" as any,
            payload: "bad",
            deleted: false,
          },
        ])
        .catch((e) => console.log("EVIDENCE BUG-2 batch error:", String(e.message).slice(0, 160)));
      const pulled = await rt.pullAll(CFG, space, auth, 0);
      console.log("EVIDENCE BUG-2 records stored after batch:", pulled.length);
      expect(pulled.map((r) => r.rid)).toContain(goodRid);
    }
  );

  it.fails(
    "BUG-3 a pull cursor must see a later edit to a record already pulled (seq advances on UPDATE)",
    async () => {
      const { space, auth } = newSpace();
      await rt.claimSpace(CFG, space, auth);
      const rid = hex(32);
      await rt.pushAll(CFG, space, auth, [
        { collection: "settings", rid, version: 100, payload: "A1", deleted: false },
      ]);
      const firstPull = await rt.pullAll(CFG, space, auth, 0);
      const cursor = Math.max(...firstPull.map((r) => r.seq));
      await rt.pushAll(CFG, space, auth, [
        { collection: "settings", rid, version: 200, payload: "A2", deleted: false },
      ]);
      const second = await rt.pullAll(CFG, space, auth, cursor);
      console.log(
        "EVIDENCE BUG-3 edit visible to cursor",
        cursor,
        "->",
        JSON.stringify(second.map((r) => r.payload))
      );
      expect(second.map((r) => r.payload)).toContain("A2");
    }
  );

  it.fails(
    "BUG-4 a far-future version cannot permanently freeze a record for other devices",
    async () => {
      const { space, auth } = newSpace();
      await rt.claimSpace(CFG, space, auth);
      const rid = hex(32);
      await rt.pushAll(CFG, space, auth, [
        {
          collection: "settings",
          rid,
          version: 9000000000000000,
          payload: "FUTURE",
          deleted: false,
        },
      ]);
      const honest = await rt.pushAll(CFG, space, auth, [
        { collection: "settings", rid, version: 1700000000000, payload: "HONEST", deleted: false },
      ]);
      console.log("EVIDENCE BUG-4 honest device push status:", honest[0].status);
      expect(honest[0].status).toBe("ok");
    }
  );

  it("BUG-5 payloads are capped (client rule: <150 KB; DB accepted 2 MB in this test)", async () => {
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
