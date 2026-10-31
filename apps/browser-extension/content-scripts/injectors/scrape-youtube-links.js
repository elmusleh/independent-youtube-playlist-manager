(function () {
  // Scan only the current document. Never read cross-origin frame contents or log page data.
  const ids = new Set();
  const links = [];
  function add(raw) {
    try {
      const url = new URL(raw, location.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      const host = url.hostname;
      if (host !== "youtu.be" && host !== "youtube.com" && !host.endsWith(".youtube.com")) return;
      const id =
        host === "youtu.be"
          ? url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1]
          : url.pathname === "/watch"
            ? url.searchParams.get("v")
            : url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})\/?$/)?.[1];
      if (!id || !/^[\w-]{11}$/.test(id) || ids.has(id) || ids.size >= 100000) return;
      ids.add(id);
      links.push({ id });
    } catch {
      /* Ignore malformed page links. */
    }
  }
  for (const node of document.querySelectorAll("a[href]")) add(node.getAttribute("href"));
  for (const node of document.querySelectorAll("iframe[src]")) add(node.getAttribute("src"));
  for (const match of (document.body?.innerText || "").matchAll(/https?:\/\/[^\s<>"']+/g))
    add(match[0]);
  return { count: links.length, links };
})();
