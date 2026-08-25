import { describe, it, expect } from "vitest";
import { sanitizeVideoId, isoToSecs, secsToISO } from "./schema-normalizer";

describe("sanitizeVideoId", () => {
  it("returns a clean 11-char ID unchanged", () => {
    expect(sanitizeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a full youtube.com/watch URL", () => {
    expect(sanitizeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a youtu.be short URL", () => {
    expect(sanitizeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from an embed URL", () => {
    expect(sanitizeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeVideoId("")).toBe("");
  });

  it("returns trimmed value when not a URL but not empty", () => {
    expect(sanitizeVideoId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });
});

describe("isoToSecs", () => {
  it("converts PT5M30S to 330 seconds", () => {
    expect(isoToSecs("PT5M30S")).toBe(330);
  });

  it("converts PT1H to 3600 seconds", () => {
    expect(isoToSecs("PT1H")).toBe(3600);
  });

  it("converts PT1H30M15S to 5415 seconds", () => {
    expect(isoToSecs("PT1H30M15S")).toBe(5415);
  });

  it("returns 0 for LIVE", () => {
    expect(isoToSecs("LIVE")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(isoToSecs("")).toBe(0);
  });

  it("handles days: P1DT2H → 93600 seconds", () => {
    expect(isoToSecs("P1DT2H")).toBe(93600);
  });
});

describe("secsToISO", () => {
  it("converts 330 seconds to PT5M30S", () => {
    expect(secsToISO(330)).toBe("PT5M30S");
  });

  it("converts 3600 seconds to PT1H", () => {
    expect(secsToISO(3600)).toBe("PT1H");
  });

  it("converts 5415 seconds to PT1H30M15S", () => {
    expect(secsToISO(5415)).toBe("PT1H30M15S");
  });

  it("returns empty string for NaN", () => {
    expect(secsToISO(NaN)).toBe("");
  });

  it("returns empty string for negative", () => {
    expect(secsToISO(-5)).toBe("");
  });

  it("returns PT0S for 0", () => {
    expect(secsToISO(0)).toBe("PT0S");
  });
});