import { describe, it, expect } from "vitest";
import { generateSyncKeyQrSvg } from "./qr-service";

describe("qr-service", () => {
  it("generates an SVG string for a valid sync key", () => {
    const key = "ABCDE-FGHJK-MNPQR-STVWX";
    const svg = generateSyncKeyQrSvg(key);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox=");
  });

  it("handles empty key gracefully", () => {
    expect(generateSyncKeyQrSvg("")).toBe("");
  });
});
