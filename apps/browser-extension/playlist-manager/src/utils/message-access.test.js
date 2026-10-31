import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { permittedUI } from "../../../background/message-access.js";

/**
 * The capture and library listeners call permittedUI before touching any job. These cases
 * pin the sender checks a foreign sender would have to defeat: another extension id, a
 * web page, a content script inside our own extension, a non-allowed UI page, an incognito
 * tab and malformed input.
 */

const EXTENSION_ID = "test";
const CAPTURE_ROUTE = `chrome-extension://${EXTENSION_ID}/editor/index.html#/capture?job=test`;
const POPUP = `chrome-extension://${EXTENSION_ID}/popup/popup.html`;

const sender = (overrides = {}) => ({ id: EXTENSION_ID, url: CAPTURE_ROUTE, ...overrides });

beforeEach(() => {
  vi.stubGlobal("browser", {
    runtime: { id: EXTENSION_ID, getURL: (path) => `chrome-extension://${EXTENSION_ID}${path}` },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("permittedUI sender checks", () => {
  it("accepts the capture route on the extension's own editor page", () => {
    expect(permittedUI(sender(), true)).toBe(true);
  });

  it("accepts the popup only when it is not asking for capture-only access", () => {
    expect(permittedUI(sender({ url: POPUP }), false)).toBe(true);
    expect(permittedUI(sender({ url: POPUP }), true)).toBe(false);
  });

  it("refuses a sender from a different extension id", () => {
    expect(permittedUI(sender({ id: "other-extension" }), true)).toBe(false);
    expect(permittedUI(sender({ id: "other-extension" }), false)).toBe(false);
  });

  it("refuses a non-extension web page sender", () => {
    expect(permittedUI(sender({ url: "https://www.youtube.com/watch?v=abcdefghijk" }), true)).toBe(
      false
    );
    expect(permittedUI(sender({ url: "https://evil.example/editor/index.html" }), false)).toBe(
      false
    );
  });

  it("refuses a content script running inside the extension origin", () => {
    expect(
      permittedUI(sender({ url: `chrome-extension://${EXTENSION_ID}/content-scripts/x.js` }))
    ).toBe(false);
    expect(
      permittedUI(sender({ url: `chrome-extension://${EXTENSION_ID}/background/index.js` }))
    ).toBe(false);
  });

  it("refuses a non-capture route on the editor page when capture-only access is requested", () => {
    expect(
      permittedUI(
        sender({ url: `chrome-extension://${EXTENSION_ID}/editor/index.html#/saved` }),
        true
      )
    ).toBe(false);
  });

  it("refuses a sender without a url", () => {
    expect(permittedUI({ id: EXTENSION_ID }, true)).toBe(false);
    expect(permittedUI({ id: EXTENSION_ID, url: "" }, true)).toBe(false);
  });

  it("refuses a malformed url instead of throwing", () => {
    expect(permittedUI(sender({ url: "not a url" }), true)).toBe(false);
  });

  it("refuses an incognito sender tab", () => {
    expect(permittedUI(sender({ tab: { incognito: true } }), true)).toBe(false);
  });

  it("refuses missing or empty senders", () => {
    expect(permittedUI(undefined, true)).toBe(false);
    expect(permittedUI(null, true)).toBe(false);
    expect(permittedUI({}, true)).toBe(false);
  });
});
