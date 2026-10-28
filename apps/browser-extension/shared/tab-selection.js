/** Return the YouTube video id for a URL, or null for non-video pages. */
export function parseYouTubeVideoId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(parsed.hostname)) return null;
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
    if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
    const match = parsed.pathname.match(/^\/(shorts|live|embed)\/([^/]+)/);
    return match ? match[2] : null;
  } catch {
    return null;
  }
}

/** Resolve the tabs represented by a native context-menu scope. */
export function tabsForScope(scope, anchor, tabs) {
  const ordered = [...tabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const anchorId = anchor?.id;
  const windowId = anchor?.windowId;
  if (scope === "current") return anchor ? [anchor] : [];
  if (scope === "selected") {
    const selected = ordered.filter((tab) => tab.highlighted && tab.windowId === windowId);
    return selected.length ? selected : anchor ? [anchor] : [];
  }
  if (scope === "left" || scope === "right") {
    const inWindow = ordered.filter((tab) => tab.windowId === windowId);
    const position = inWindow.findIndex((tab) => tab.id === anchorId);
    if (position < 0) return [];
    return scope === "left" ? inWindow.slice(0, position) : inWindow.slice(position + 1);
  }
  if (scope === "window") return ordered.filter((tab) => tab.windowId === windowId);
  if (scope === "other")
    return ordered.filter((tab) => tab.windowId === windowId && tab.id !== anchorId);
  return ordered;
}

export function youtubeTabs(tabs) {
  const seen = new Set();
  return tabs.flatMap((tab) => {
    const id = parseYouTubeVideoId(tab.url);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, tab }];
  });
}
