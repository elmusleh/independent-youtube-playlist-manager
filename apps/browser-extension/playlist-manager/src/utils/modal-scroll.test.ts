import { expect, it } from "vitest";
import { lockPageScroll } from "./modal-scroll";

it("keeps the page locked until all dialogs close, including out-of-order cleanup", () => {
  document.documentElement.style.overflow = "auto";
  const closeFirst = lockPageScroll();
  const closeSecond = lockPageScroll();
  closeFirst();
  closeFirst();
  expect(document.documentElement.style.overflow).toBe("hidden");
  closeSecond();
  expect(document.documentElement.style.overflow).toBe("auto");
  document.documentElement.style.overflow = "";
});
