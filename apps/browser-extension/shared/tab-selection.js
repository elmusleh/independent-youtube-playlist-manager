/** Return the YouTube video id for a URL, or null for non-video pages. */
export function parseYouTubeVideoId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const host = parsed.hostname;
    if (host !== "youtu.be" && host !== "youtube.com" && !host.endsWith(".youtube.com"))
      return null;
    const id =
      host === "youtu.be"
        ? parsed.pathname.match(/^\/([\w-]{11})\/?$/)?.[1]
        : parsed.pathname === "/watch"
          ? parsed.searchParams.get("v")
          : parsed.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})\/?$/)?.[1];
    return typeof id === "string" && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Resolve the tabs represented by a native context-menu scope. */
export function tabsForScope(scope, anchor, tabs) {
  if (
    !anchor ||
    anchor.incognito ||
    !Number.isInteger(anchor.id) ||
    !Number.isInteger(anchor.windowId)
  )
    return [];
  const ordered = tabs
    .filter((tab) => !tab.incognito)
    .sort((a, b) => {
      if (a.windowId === b.windowId) return (a.index ?? 0) - (b.index ?? 0);
      if (a.windowId === anchor.windowId) return -1;
      if (b.windowId === anchor.windowId) return 1;
      return a.windowId - b.windowId;
    });
  const anchorId = anchor?.id;
  const windowId = anchor?.windowId;
  if (scope === "current") return anchor ? [anchor] : [];
  if (scope === "selected") {
    if (!anchor.highlighted) return [anchor];
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
  return scope === "all" ? ordered : [];
}

export function youtubeTabs(tabs) {
  const seen = new Set();
  return tabs.flatMap((tab) => {
    if (tab.incognito) return [];
    const id = parseYouTubeVideoId(tab.url);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, tab }];
  });
}
