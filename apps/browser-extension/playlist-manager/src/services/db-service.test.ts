import { describe, it, expect } from "vitest";
import { metaKey, isMetaKey } from "./db-service";

describe("metaKey", () => {
  it("converts a normal video ID to yph:meta:VIDEO_ID", () => {
    expect(metaKey("dQw4w9WgXcQ")).toBe("yph:meta:dQw4w9WgXcQ");
  });

  it("returns yph:meta: for an empty string", () => {
    expect(metaKey("")).toBe("yph:meta:");
  });

  it("sanitizes video IDs from URLs", () => {
    expect(metaKey("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("yph:meta:dQw4w9WgXcQ");
  });

  it("handles video IDs with special characters by sanitizing them", () => {
    const result = metaKey("abc def!@#");
    expect(result).toBe("yph:meta:abc def!@#");
  });

  it("handles a raw 11-char ID with special chars, passing through sanitizeVideoId", () => {
    expect(metaKey("dQw4w9WgXcQ")).toBe("yph:meta:dQw4w9WgXcQ");
  });
});

describe("isMetaKey", () => {
  it("returns true for a valid meta key", () => {
    expect(isMetaKey("yph:meta:abc123")).toBe(true);
  });

  it("returns true for yph:meta: with empty video ID", () => {
    expect(isMetaKey("yph:meta:")).toBe(true);
  });

  it("returns false for a non-meta key", () => {
    expect(isMetaKey("yph:other:abc123")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isMetaKey("")).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isMetaKey(42)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isMetaKey(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isMetaKey(undefined)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isMetaKey({})).toBe(false);
  });
});
