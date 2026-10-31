/**
 * The single source of truth for the visual-regression matrix.
 *
 * `views.spec.ts` imports this to know which views/widths/themes to snapshot, and
 * `packages/build-tools/verify-visual-baselines.js` imports it to cross-check the
 * committed baselines. Keep the two in lockstep by editing only this file.
 *
 * The snapshot filename Playwright writes is `${id}-${theme}-${size.id}-${project}-${platform}.png`
 * (e.g. `settings-light-mobile-chromium-linux.png`).
 */
module.exports = {
  THEMES: ["light", "dark"],
  SIZES: [
    { id: "mobile", width: 390, height: 844 },
    { id: "desktop", width: 1440, height: 900 },
  ],
  ROUTES: [
    { id: "settings", hash: "/settings", ready: ".settings-grid > .card", shot: ".settings-grid" },
    { id: "saved", hash: "/saved", ready: ".playlist-card", shot: ".playlist-grid" },
    { id: "manage", hash: "/manage", ready: ".row-content", shot: ".list-container" },
    { id: "history", hash: "/history", ready: ".history-item", shot: ".history-container" },
  ],
};
