import { vi } from "vitest";
/** Use real worker mutations with an in-memory browser store; no alternate write path. */
export async function libraryFixture(initial: Record<string, any> = {}) {
  const stored = structuredClone(initial);
  const listeners: Function[] = [];
  const api = {
    runtime: {
      id: "test",
      getURL: (path: string) => `chrome-extension://test${path}`,
      onMessage: { addListener: (fn: Function) => listeners.push(fn) },
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[] | null) => {
          if (keys === null) return structuredClone(stored);
          return structuredClone(
            Object.fromEntries(
              (Array.isArray(keys) ? keys : [keys]).map((key) => [key, stored[key]])
            )
          );
        }),
        set: vi.fn(async (value: object) => {
          Object.assign(stored, structuredClone(value));
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key];
        }),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 50 }),
      remove: vi.fn(),
    },
    scripting: { executeScript: vi.fn() },
  };
  vi.stubGlobal("browser", api);
  vi.stubGlobal("yphMutateLibrary", undefined);
  const { mutateLibrary } = await import("../../../background/library-mutations.js");
  return { stored, api, mutateLibrary, listeners };
}
