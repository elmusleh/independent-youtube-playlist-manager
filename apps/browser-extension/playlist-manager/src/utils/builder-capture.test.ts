import { expect, it } from "vitest";
import { builderAdditions } from "./builder-capture";
it("preserves dirty removals and ordering while merging only new captures", () => {
  const seen = new Set(["abcdefghijk", "12345678901"]);
  const dirtyOrder = ["12345678901"];
  expect(builderAdditions(["abcdefghijk", "12345678901", "ZYXWVUTSRQP"], seen, dirtyOrder)).toEqual(
    ["ZYXWVUTSRQP"]
  );
  expect(dirtyOrder).toEqual(["12345678901"]);
});
