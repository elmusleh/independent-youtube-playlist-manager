import { describe, expect, it } from "vitest";
import { countGraphemes, splitGraphemes } from "./utils";

describe("Unicode Grapheme Utils", () => {
  it("counts standard single-codepoint characters and emoji", () => {
    expect(countGraphemes("hello")).toBe(5);
    expect(countGraphemes("🎂🥪🐈")).toBe(3);
  });

  it("counts multi-codepoint ZWJ sequences as single graphemes", () => {
    // 🐈‍⬛ is Cat (U+1F408) + ZWJ (U+200D) + Black Large Square (U+2B1B)
    const blackCat = "🐈\u200D⬛";
    expect([...blackCat].length).toBe(3); // 3 codepoints
    expect(countGraphemes(blackCat)).toBe(1); // 1 grapheme cluster
  });

  it("counts complex emoji clusters with modifiers", () => {
    // Thumbs up with skin tone modifier
    const thumbsUpMedium = "👍🏽";
    expect([...thumbsUpMedium].length).toBe(2);
    expect(countGraphemes(thumbsUpMedium)).toBe(1);
  });

  it("splits graphemes correctly", () => {
    const mixed = "A🎂🐈\u200D⬛B";
    const clusters = splitGraphemes(mixed);
    expect(clusters).toEqual(["A", "🎂", "🐈\u200D⬛", "B"]);
    expect(clusters).toHaveLength(4);
  });
});
