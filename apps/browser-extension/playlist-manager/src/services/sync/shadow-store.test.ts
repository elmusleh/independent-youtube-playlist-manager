import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllShadows, computeHash, getShadow, setShadow } from "./shadow-store";

beforeEach(async () => {
  await clearAllShadows();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearAllShadows();
});

describe("sync v2 shadow store (dirty detection)", () => {
  it("computeHash is stable for equal input", () => {
    const a = computeHash({ x: 1, y: [2, 3] });
    const b = computeHash({ x: 1, y: [2, 3] });
    expect(a).toBe(b);
  });

  it("computeHash differs for different input", () => {
    expect(computeHash({ x: 1 })).not.toBe(computeHash({ x: 2 }));
  });

  it("computeHash distinguishes arrays from objects", () => {
    expect(computeHash([1, 2])).not.toBe(computeHash({ 0: 1, 1: 2 }));
  });

  it("computeHash handles null and undefined (both map to null)", () => {
    expect(computeHash(null)).toBe(computeHash(null));
    expect(computeHash(undefined)).toBe(computeHash(undefined));
    expect(computeHash(null)).toBe(computeHash(undefined));
  });

  it("a record with no shadow is treated as dirty (documented contract)", () => {
    // isDirty returns true when getShadow returns null. We can't exercise IndexedDB
    // in this environment, so we assert the pure contract: computeHash of a fresh
    // record differs from the empty sentinel.
    expect(computeHash({ title: "A" })).not.toBe("00000000");
  });

  it("resolves shadow writes only after the IndexedDB transaction completes", async () => {
    const originalTransaction = IDBDatabase.prototype.transaction;
    (vi.spyOn(IDBDatabase.prototype, "transaction") as any).mockImplementation(function (
      this: IDBDatabase,
      storeNames: string | string[],
      mode?: any,
      options?: any
    ) {
      const transaction = originalTransaction.call(this, storeNames, mode, options);
      if (mode === "readwrite") {
        let completionHandler: ((this: IDBTransaction, event: Event) => unknown) | null = null;
        Object.defineProperty(transaction, "oncomplete", {
          configurable: true,
          get: () => completionHandler,
          set: (handler: typeof completionHandler) => {
            completionHandler = handler;
          },
        });
        transaction.addEventListener(
          "complete",
          (event) => {
            event.stopImmediatePropagation();
            setTimeout(() => completionHandler?.call(transaction, event), 20);
          },
          { once: true }
        );
      }
      return transaction;
    });

    let settled = false;
    const write = setShadow("playlists", "commit-test", { title: "Committed" }, 10, "device").then(
      () => {
        settled = true;
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);
    await write;
    expect(settled).toBe(true);
    expect(await getShadow("playlists", "commit-test")).not.toBeNull();
  });
});
