// Engine-level evidence. Every bug check first proves the engine REACHED the network
// (guard), so an unreached path cannot masquerade as a fix or a bug.
import { describe, it, expect, afterEach, vi } from "vitest";
const KEY = "ABCDEFGHJKMNPQRSTVWX";
function install(extra: Record<string, any> = {}) {
  const data: any = {
    yph_sync_config: {
      syncKey: KEY,
      backends: ["relay"],
      lastSeq: 0,
      relayUrl: "https://fake.supabase.test",
      relayAnonKey: "anon-test",
    },
    ...extra,
  };
  const writes: string[] = [];
  const listeners: any[] = [];
  (globalThis as any).browser = {
    storage: {
      local: {
        get: async (k: any) => (typeof k === "string" ? { [k]: data[k] } : { ...data }),
        set: async (o: any) => {
          for (const k of Object.keys(o)) {
            writes.push(k);
            data[k] = o[k];
          }
          for (const l of listeners) l({}, "local");
        },
      },
      onChanged: { addListener: (l: any) => listeners.push(l) },
    },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
    runtime: { onStartup: { addListener() {} }, onMessage: { addListener() {} } },
  };
  return { data, writes };
}
const load = async () => {
  vi.resetModules();
  return (await import("../../sync-engine")) as any;
};
afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as any).browser;
  delete (globalThis as any).window;
});

describe("engine bugs (guarded)", () => {
  it("BUG-8 configured device actually runs a sync (reaches network)", async () => {
    install();
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: any) => {
        calls.push(String(u));
        return new Response("[]", { status: 200 });
      })
    );
    const eng = await load();
    const s = await eng.runOnce();
    console.log("EVIDENCE BUG-8:", s.lastSummary, "network calls:", calls.length);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("BUG-7 engine never uploads plaintext playlist content", async () => {
    install({ yph_local_playlists: [] });
    (globalThis as any).window = {
      getPlaylists: async () => [
        {
          id: "local-1",
          title: "SECRET-PLAYLIST-NAME",
          videos: ["abc123def45"],
          updatedAt: 1762250000000,
          revision: 1,
        },
      ],
      getSettings: async () => ({ themeChoice: "dark" }),
    };
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: any, init: any) => {
        if (String(u).includes("sync_push") && init?.body) bodies.push(String(init.body));
        return new Response(String(u).includes("sync_pull") ? "[]" : "true", { status: 200 });
      })
    );
    const eng = await load();
    await eng.runOnce();
    console.log(
      "EVIDENCE BUG-7 push bodies:",
      bodies.length,
      "plaintext leaked:",
      bodies.join("").includes("SECRET-PLAYLIST-NAME")
    );
    expect(bodies.length).toBeGreaterThan(0); // guard
    expect(bodies.join("").includes("SECRET-PLAYLIST-NAME")).toBe(false);
  });
});
