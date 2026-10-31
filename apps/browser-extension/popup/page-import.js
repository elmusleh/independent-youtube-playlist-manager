import { getActiveTab } from "./tabs.js";

let sourceTab = null;

export function showPageImportError(message = "") {
  const error = document.getElementById("page-import-error");
  if (error) {
    error.textContent = message;
    error.hidden = !message;
    if (message) error.scrollIntoView?.({ block: "nearest" });
  }
}

export async function preparePageImport() {
  sourceTab = null;
  showPageImportError();
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) throw new Error("No webpage selected. Open a webpage and try again.");
  if (tab.incognito) throw new Error("Import from private windows is disabled.");
  const url = new URL(tab.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("This browser page cannot be scanned. Open a regular HTTP or HTTPS webpage.");
  }
  sourceTab = { id: tab.id, url: tab.url, title: tab.title, windowId: tab.windowId };
  return sourceTab;
}

export async function getPageImportTab() {
  if (!sourceTab) throw new Error("Reopen the extension and choose Import from Page first.");
  let tab;
  try {
    tab = await browser.tabs.get(sourceTab.id);
  } catch {
    throw new Error("The selected page was closed. Reopen the extension on another page.");
  }
  if (tab.incognito || tab.url !== sourceTab.url || tab.windowId !== sourceTab.windowId) {
    throw new Error("The selected page changed. Reopen the extension to scan the new page.");
  }
  return tab;
}

export function importQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000 || value === "") {
    throw new Error("Enter a whole number from 0 to 1000. Use 0 to import all videos.");
  }
  return quantity;
}

export function pageAccessError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/cannot access|missing host permission|not allowed|permission.*denied/i.test(message)) {
    return "This page cannot be scanned. Open the extension from its toolbar button on a regular webpage. Browser stores and other protected pages restrict access.";
  }
  return message;
}
