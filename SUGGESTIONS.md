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

## Done

(none yet — ledger started 2026-11-01)
