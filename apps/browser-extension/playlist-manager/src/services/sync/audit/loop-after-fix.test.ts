// With ONLY the BUG-8 read fixed (scratch copy), does the engine self-retrigger?
import { it, expect, vi, afterEach } from "vitest";
const KEY = "ABCDEFGHJKMNPQRSTVWX";
afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as any).browser;
});
it("measures runs over 12s after one user-triggered sync (fixed copy)", async () => {
  const data: any = {
    yph_sync_config: {
      syncKey: KEY,
      backends: ["relay"],
      lastSeq: 0,
      relayUrl: "https://fake.supabase.test",
      relayAnonKey: "anon-test",
    },
  };
  const listeners: any[] = [];
  (globalThis as any).browser = {
    storage: {
      local: {
        get: async (k: any) => (typeof k === "string" ? { [k]: data[k] } : { ...data }),
        set: async (o: any) => {
          const ch: any = {};
          for (const k of Object.keys(o)) {
            data[k] = o[k];
            ch[k] = { newValue: o[k] };
          }
          for (const l of listeners) l(ch, "local");
        },
      },
      onChanged: { addListener: (l: any) => listeners.push(l) },
    },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
    runtime: { onStartup: { addListener() {} }, onMessage: { addListener() {} } },
  };
  let runs = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: any) => {
      if (String(u).includes("sync_claim")) runs++;
      return new Response(String(u).includes("sync_pull") ? "[]" : "true", { status: 200 });
    })
  );
  vi.resetModules();
  const eng: any = await import("../../sync-engine");
  await eng.runOnce();
  const first = runs;
  await new Promise((r) => setTimeout(r, 12000));
  console.log("LOOP runs after first:", first, "runs after 12s:", runs);
  expect(first).toBeGreaterThan(0); // guard: the fixed engine really synced
  expect(runs).toBe(first); // a loop-free engine stays at the first run
}, 30000);
