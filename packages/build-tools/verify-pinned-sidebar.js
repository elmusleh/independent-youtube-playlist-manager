/* global window */
async function verifyPinnedSidebarTruncation(page) {
  const row = page.locator(
    '.desktop-sidenav a.favorite-nav-link[href="#/playlist?id=local-release"]'
  );
  await row.evaluate((link) => {
    const title = link.querySelector(".favorite-nav-title");
    if (link.scrollWidth > link.clientWidth || title.scrollWidth <= title.clientWidth)
      throw new Error("Desktop pinned title is not ellipsized");
    if (window.getComputedStyle(title).textOverflow !== "ellipsis")
      throw new Error("Desktop pinned title lacks ellipsis styling");
  });
  if (
    !(await page.evaluate(() => window.document.documentElement.scrollWidth <= window.innerWidth))
  )
    throw new Error("Sidebar allows horizontal overflow");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  const drawer = page.locator(
    '.mobile-drawer .drawer-nav a.favorite-nav-link[href="#/playlist?id=local-release"]'
  );
  await drawer.waitFor();
  await drawer.evaluate((link) => {
    const title = link.querySelector(".favorite-nav-title");
    if (link.scrollWidth > link.clientWidth || title.scrollWidth <= title.clientWidth)
      throw new Error("Mobile pinned title is not ellipsized");
    if (window.getComputedStyle(title).textOverflow !== "ellipsis")
      throw new Error("Mobile pinned title lacks ellipsis styling");
  });
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
}
module.exports = { verifyPinnedSidebarTruncation };
