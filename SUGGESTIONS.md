# Suggestions Ledger

Every improvement/next-step suggestion offered to the owner is recorded here so
it is never repeated. After each implementation, append the new suggestions
(see `~/dev/AGENTS.md` § Post-Implementation Suggestions) and tag each:
`[done]` once implemented, `[skip]` if declined, `[accepted]` if queued.

## Pending

1. Migrate the remaining `global.css` form-element base styles to tokens —
   `input/button/select/textarea` still uses `0.4em` / `2px` magic values that
   ignore `--space-*` / `--radius-*`. (Best practices)
2. Add the `/playlist` editor route to the visual snapshot matrix — the
   EditorToolbar isn't snapshotted, so a toolbar regression has no pixel guard. (Testing)
3. Assert the `.is-stuck` elevation in the sticky test — the "floating nav"
   shadow isn't asserted, only the pin geometry is. (Testing)
4. Add a 60-second demo GIF/video at the top of README showing right-click → save
   to playlist; README hero currently has no visual. Priority 85% (High value)
   [Professionalism]. What: embed a short screen recording in the README hero.
   Why: visitors decide to star in ~3 seconds; text alone under-converts.
   How: record with asciinema/ffmpeg, host in repo or asciinema.org, add
   `![demo](...)` above the badges.
5. Submit the existing Chrome build to Opera/Brave/Vivaldi stores (zero code
   change, store listings only). Priority 70% (High value) [Best practices].
   What: publish the already-built Chrome ZIP to additional Chromium stores.
   Why: multiplies discoverability at near-zero engineering cost.
   How: create dev accounts, upload dist/chrome ZIP, reuse Chrome listing copy.
6. Add GitHub topics/tags (`youtube`, `playlist-manager`, `browser-extension`,
   `webextension`, `svelte`, `firefox-android`) and a Discussions tab. Priority
   60% (Nice to have) [Professionalism].
7. Ship Microsoft Edge via Partner Center (build already generates dist/edge).
   Priority 80% (High value) [Best practices]. How: upload dist/edge ZIP, fill
   listing, submit; flip README 🚧→✅ when approved.
8. Add partial i18n (de, ar, es) to multiply addressable audience. Priority
   55% (Nice to have) [Best practices].
9. Enable GitHub Discussions for feature requests; keep Issues for bugs. Priority
   50% (Nice to have) [Professionalism].

10. Resolve the SyncHero.svelte 353-line file-size gate (limit 350). Priority
    40% (Nice to have) [Best practices]. What: split or allowlist the file.
    Why: `verify-file-size.js` currently fails. How: extract a sub-component or
    add exact path to allowlist if legacy.
11. Add a test asserting the extension makes no outbound request to
    api.github.com. Priority 60% (High value) [Testing]. What: extend
    verify-extension or add a unit test checking no fetch to GitHub. Why: guards
    against re-introducing the removed request. How: add assertion in
    packages/build-tools/verify-extension.js network audit.

## Done

1. Fix the 5 pre-existing Prettier formatting violations so `npm run check`
   passes cleanly. [done] 2026-11-04
2. Update PRIVACY_POLICY.md to state the extension makes no GitHub API call.
   [done] 2026-11-04
