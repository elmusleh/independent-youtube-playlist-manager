// @vitest-environment node
import { expect, it } from "vitest";
import { hasYoutubeClientId } from "./youtube-credentials";

it("accepts a non-empty trimmed Client ID", () => {
  expect(hasYoutubeClientId({ clientId: "abc.apps.googleusercontent.com" })).toBe(true);
  expect(hasYoutubeClientId({ clientId: "  abc.apps.googleusercontent.com  " })).toBe(true);
});

it("rejects an empty Client ID", () => {
  expect(hasYoutubeClientId({ clientId: "" })).toBe(false);
});

it("rejects a whitespace-only Client ID", () => {
  expect(hasYoutubeClientId({ clientId: "   \t\n " })).toBe(false);
});

it("rejects missing or null credentials", () => {
  expect(hasYoutubeClientId({})).toBe(false);
  expect(hasYoutubeClientId(null)).toBe(false);
  expect(hasYoutubeClientId(undefined)).toBe(false);
  expect(hasYoutubeClientId({ clientId: null })).toBe(false);
});

it("rejects credentials with only an API key", () => {
  expect(hasYoutubeClientId({ apiKey: "AIzaSyB" } as { clientId?: unknown })).toBe(false);
});
