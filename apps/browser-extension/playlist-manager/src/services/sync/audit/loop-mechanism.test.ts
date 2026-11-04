// Attribute each follow-up run to the storage key that caused it.
import { it, expect, vi, afterEach } from "vitest";
const KEY = "ABCDEFGHJKMNPQRSTVWX";
afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as any).browser;
});
it.skip("attributes each re-run to the storage write that triggered it", async () => {
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
  const triggers: string[] = [];
  let pending = "user";
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
          pending = Object.keys(o).join("+");
          for (const l of listeners) l(ch, "local");
        },
      },
      onChanged: { addListener: (l: any) => listeners.push(l) },
    },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
    runtime: { onStartup: { addListener() {} }, onMessage: { addListener() {} } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: any) => {
      if (String(u).includes("sync_claim")) triggers.push(pending);
      return new Response(String(u).includes("sync_pull") ? "[]" : "true", { status: 200 });
    })
  );
  vi.resetModules();
  const eng: any = await import("../../sync-engine");
  await eng.runOnce();
  await new Promise((r) => setTimeout(r, 12000));
  console.log("TRIGGERS:", JSON.stringify(triggers));
  expect(triggers.length).toBeGreaterThan(1);
}, 30000);
