import { afterEach, describe, expect, it, vi } from "vitest";
import { getHeaderHeight, resetHeaderHeight } from "./header-height";

function stubHeaderHeight(value: string) {
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (prop: string) => (prop === "--app-header-height" ? value : ""),
  }));
}

describe("getHeaderHeight", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetHeaderHeight();
  });

  it("parses the token once and reuses the cached value", () => {
    stubHeaderHeight("56px");
    expect(getHeaderHeight()).toBe(56);
    // Change the underlying token: the cached value must still be returned.
    stubHeaderHeight("52px");
    expect(getHeaderHeight()).toBe(56);
  });

  it("re-reads the token after resetHeaderHeight()", () => {
    stubHeaderHeight("56px");
    expect(getHeaderHeight()).toBe(56);
    stubHeaderHeight("52px");
    resetHeaderHeight();
    expect(getHeaderHeight()).toBe(52);
  });

  it("falls back to 56 when the token is missing or invalid", () => {
    stubHeaderHeight("");
    expect(getHeaderHeight()).toBe(56);
    resetHeaderHeight();
    stubHeaderHeight("not-a-number");
    expect(getHeaderHeight()).toBe(56);
  });
});
