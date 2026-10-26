import { expect, it, vi, afterEach } from "vitest";
import { get } from "svelte/store";
afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});
it("uses the saved dark theme before asynchronous extension settings resolve", async () => {
  localStorage.setItem("yph-theme-choice", "dark");
  const { currentTheme } = await import("./theme.store");
  expect(get(currentTheme)).toBe("dark");
});
