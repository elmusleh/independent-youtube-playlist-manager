import { beforeEach, describe, expect, it } from "vitest";
import { trapTabKey, visibleFocusable } from "./modal-focus";

// jsdom has no layout engine, so client rects are always empty; assume rendered.
const allVisible = () => true;

function makeDialog(html: string) {
  const dialog = document.createElement("div");
  dialog.innerHTML = html;
  document.body.append(dialog);
  return dialog as unknown as HTMLElement;
}

function tab(shiftKey = false) {
  return new KeyboardEvent("keydown", { key: "Tab", shiftKey, cancelable: true });
}

describe("modal focus containment", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("lists only focusable, rendered controls", () => {
    const dialog = makeDialog(
      '<button>a</button><button disabled>b</button><input type="hidden" />' +
        '<a href="/x">c</a><span tabindex="-1">d</span><button>e</button>'
    );
    expect(visibleFocusable(dialog, allVisible).map((element) => element.textContent)).toEqual([
      "a",
      "c",
      "e",
    ]);
  });

  it("wraps from the last control back to the first", () => {
    const dialog = makeDialog("<button>first</button><button>last</button>");
    const [first, last] = Array.from(dialog.querySelectorAll("button"));
    last.focus();
    const event = tab();
    expect(trapTabKey(dialog, event, allVisible)).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it("wraps backwards from the first control to the last", () => {
    const dialog = makeDialog("<button>first</button><button>last</button>");
    const [first, last] = Array.from(dialog.querySelectorAll("button"));
    first.focus();
    expect(trapTabKey(dialog, tab(true), allVisible)).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("leaves middle tab presses to the browser", () => {
    const dialog = makeDialog("<button>first</button><button>middle</button><button>last</button>");
    dialog.querySelectorAll("button")[1].focus();
    expect(trapTabKey(dialog, tab(), allVisible)).toBe(false);
    expect(trapTabKey(dialog, tab(true), allVisible)).toBe(false);
  });

  it("blocks Tab entirely when nothing is focusable", () => {
    const dialog = makeDialog("<p>Nothing to focus</p>");
    expect(trapTabKey(dialog, tab(), allVisible)).toBe(true);
  });

  it("ignores keys other than Tab", () => {
    const dialog = makeDialog("<button>only</button>");
    expect(trapTabKey(dialog, new KeyboardEvent("keydown", { key: "Escape" }), allVisible)).toBe(
      false
    );
  });
});
