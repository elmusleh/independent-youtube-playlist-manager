import { describe, expect, it } from "vitest";
import { clampPage, getPageItems } from "./pagination";

describe("pagination", () => {
  it("shows short lists and empty lists", () => {
    expect(getPageItems(4, 1)).toEqual([1, 2, 3, 4]);
    expect(getPageItems(0, 1)).toEqual([1]);
  });
  it("shows leading, middle, trailing and compact windows", () => {
    expect(getPageItems(100, 1)).toEqual([1, 2, 3, 4, 5, "ellipsis", 100]);
    expect(getPageItems(100, 50)).toEqual([1, "ellipsis", 49, 50, 51, "ellipsis", 100]);
    expect(getPageItems(100, 100)).toEqual([1, "ellipsis", 96, 97, 98, 99, 100]);
    expect(getPageItems(100, 50, 5)).toEqual([1, "ellipsis", 50, "ellipsis", 100]);
  });
  it("stays bounded and ordered at every boundary", () => {
    for (const budget of [5, 7] as const) {
      for (const total of [1, 5, 6, 7, 8, 10, 100, 10000]) {
        for (const page of [1, 2, 3, 4, 5, 6, 50, total - 4, total - 1, total]) {
          const items = getPageItems(total, page, budget);
          const numbers = items.filter((item): item is number => typeof item === "number");
          expect(items.length).toBeLessThanOrEqual(budget);
          expect(numbers[0]).toBe(1);
          expect(numbers[numbers.length - 1]).toBe(total);
          expect(numbers).toContain(clampPage(page, total));
          expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
          expect(numbers.every((value) => value >= 1 && value <= total)).toBe(true);
        }
      }
    }
  });
  it("clamps pages after filtering or deletion", () => {
    expect(clampPage(100, 3)).toBe(3);
    expect(clampPage(3, 0)).toBe(1);
    expect(clampPage(-1, 10)).toBe(1);
  });
});
