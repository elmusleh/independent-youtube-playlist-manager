import { describe, expect, it } from "vitest";
import { isFavorite, moveFavorite, sanitizeFavoriteIds, toggleFavorite } from "./favorites";

describe("sanitizeFavoriteIds", () => {
  it("returns an empty list for non-array input", () => {
    expect(sanitizeFavoriteIds(null)).toEqual([]);
    expect(sanitizeFavoriteIds(undefined)).toEqual([]);
    expect(sanitizeFavoriteIds("PLabc")).toEqual([]);
    expect(sanitizeFavoriteIds(42)).toEqual([]);
    expect(sanitizeFavoriteIds({ 0: "PLabc" })).toEqual([]);
  });

  it("drops non-string entries and empties while preserving order", () => {
    expect(sanitizeFavoriteIds(["PLa", 1, "PLb", "", null, "PLc", undefined])).toEqual([
      "PLa",
      "PLb",
      "PLc",
    ]);
  });

  it("de-duplicates while keeping the first occurrence", () => {
    expect(sanitizeFavoriteIds(["PLa", "PLb", "PLa", "PLc", "PLb"])).toEqual(["PLa", "PLb", "PLc"]);
  });
});

describe("isFavorite", () => {
  it("matches membership", () => {
    expect(isFavorite(["PLa"], "PLa")).toBe(true);
    expect(isFavorite(["PLa"], "PLb")).toBe(false);
    expect(isFavorite(null, "PLa")).toBe(false);
    expect(isFavorite(undefined, "PLa")).toBe(false);
  });
});

describe("toggleFavorite", () => {
  it("adds a new favorite at the end", () => {
    expect(toggleFavorite(["PLa"], "PLb")).toEqual(["PLa", "PLb"]);
    expect(toggleFavorite([], "PLa")).toEqual(["PLa"]);
  });

  it("removes an existing favorite", () => {
    expect(toggleFavorite(["PLa", "PLb"], "PLa")).toEqual(["PLb"]);
  });

  it("is stable for non-array input", () => {
    expect(toggleFavorite(undefined, "PLa")).toEqual(["PLa"]);
  });
});

describe("moveFavorite", () => {
  it("moves an item down", () => {
    expect(moveFavorite(["PLa", "PLb", "PLc"], 0, 1)).toEqual(["PLb", "PLa", "PLc"]);
  });

  it("moves an item up", () => {
    expect(moveFavorite(["PLa", "PLb", "PLc"], 2, -1)).toEqual(["PLa", "PLc", "PLb"]);
  });

  it("is a no-op at the boundaries", () => {
    expect(moveFavorite(["PLa", "PLb"], 0, -1)).toEqual(["PLa", "PLb"]);
    expect(moveFavorite(["PLa", "PLb"], 1, 1)).toEqual(["PLa", "PLb"]);
    expect(moveFavorite([], 0, 1)).toEqual([]);
  });
});
