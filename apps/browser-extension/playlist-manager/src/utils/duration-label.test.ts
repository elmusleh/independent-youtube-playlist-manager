import { describe, expect, it } from "vitest";
import {
  durationLabelToISO,
  durationLabelToSeconds,
  secondsToISO,
} from "../../../shared/duration-label.js";

describe("durationLabelToSeconds", () => {
  it("decodes YouTube clock labels", () => {
    expect(durationLabelToSeconds("4:20")).toBe(260);
    expect(durationLabelToSeconds("1:02:03")).toBe(3723);
    expect(durationLabelToSeconds("19:59")).toBe(1199);
  });

  it("rejects unknown and zero-length labels", () => {
    expect(durationLabelToSeconds("")).toBe(0);
    expect(durationLabelToSeconds("LIVE")).toBe(0);
    expect(durationLabelToSeconds("0:00")).toBe(0);
    expect(durationLabelToSeconds("not a duration")).toBe(0);
  });
});

describe("durationLabelToISO", () => {
  it("converts scraped labels to the cache format", () => {
    expect(durationLabelToISO("4:20")).toBe("PT4M20S");
    expect(durationLabelToISO("1:02:03")).toBe("PT1H2M3S");
    expect(durationLabelToISO("LIVE")).toBe("LIVE");
    expect(durationLabelToISO("0:00")).toBe("");
  });
});

describe("secondsToISO", () => {
  it("omits zero components and rejects non-positive values", () => {
    expect(secondsToISO(260)).toBe("PT4M20S");
    expect(secondsToISO(3663)).toBe("PT1H1M3S");
    expect(secondsToISO(0)).toBe("");
  });
});
