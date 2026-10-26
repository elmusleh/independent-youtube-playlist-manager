import { expect, it } from "vitest";
import { reorderItems } from "./reorder";

it("reorders the intended item through filtered identities without mutating the source", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  expect(reorderItems(items, "2", "4").map((item) => item.id)).toEqual([1, 3, 4, 2]);
  expect(reorderItems(items, 4, 2).map((item) => item.id)).toEqual([1, 4, 2, 3]);
  expect(items.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  expect(reorderItems(items, "missing", 2)).toBe(items);
  expect(reorderItems(items, 2, 2)).toBe(items);
});
