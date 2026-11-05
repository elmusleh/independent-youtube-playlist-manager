/** Extension ID alone is insufficient: content scripts share it. */
export function permittedUI(sender, captureOnly = false) {
  if (sender?.id !== browser.runtime.id || !sender.url || sender.tab?.incognito) return false;
  try {
    const source = new URL(sender.url);
    const root = new URL(browser.runtime.getURL("/"));
    if (source.protocol !== root.protocol || source.host !== root.host) return false;
    if (source.pathname === "/popup/popup.html") return !captureOnly;
    if (source.pathname !== "/editor/index.html") return false;
    return !captureOnly || source.hash.startsWith("#/capture?");
  } catch {
    return false;
  }
}
