import { afterEach, expect, it, vi } from "vitest";
import { mutateLibrary } from "../../../shared/storage-client.js";
afterEach(() => vi.unstubAllGlobals());
it("returns the same direct result through worker-local and message paths", async () => {
  const result = { id: "local-example", revision: 3 };
  const operation = {
    type: "put" as const,
    playlist: { id: "local-example", title: "Example", videos: [], timestamp: 1 },
    expectedRevision: 2,
  };
  const sendMessage = vi.fn().mockResolvedValue({ ok: true, result });
  vi.stubGlobal("browser", { runtime: { sendMessage } });
  vi.stubGlobal("yphMutateLibrary", undefined);
  expect(await mutateLibrary(operation)).toEqual(result);
  vi.stubGlobal("yphMutateLibrary", vi.fn().mockResolvedValue(result));
  expect(await mutateLibrary(operation)).toEqual(result);
  expect(sendMessage).toHaveBeenCalledTimes(1);
});
it("throws failed message responses instead of returning an error envelope", async () => {
  vi.stubGlobal("yphMutateLibrary", undefined);
  vi.stubGlobal("browser", {
    runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "Revision conflict" }) },
  });
  await expect(mutateLibrary({ type: "builder-consume", ids: [] })).rejects.toThrow(
    "Revision conflict"
  );
});
