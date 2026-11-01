# Tasks

Verifier note: the owner delegates application test/build execution to Hermes. Tasks
marked "verify" require exact command output and exit codes, not a report file or a
skipped suite. All tasks start unchecked; nothing here is implementation yet.

## 1. Sync core services (no network)

- [ ] 1.1 Implement `sync-key.ts` (generate/validate/format, no crypto) with unit tests proving malformed keys are rejected and generated keys re-validate; verify `npm run test` passes with exit 0
- [ ] 1.2 Implement `key-derivation.ts` (PBKDF2 encryption key, domain-separated SHA-256 storage address) with tests proving distinct keys give distinct outputs and derivations are deterministic; verify unit tests pass
- [ ] 1.3 Implement `snapshot-codec.ts` (schemaVersion, revision, deviceId, updatedAt envelope over the backup payload shape) with roundtrip tests; verify unit tests pass
- [ ] 1.4 Implement `encryption-service.ts` (AES-256-GCM encrypt/decrypt over injected key) with tests covering roundtrip, wrong key failure and tamper detection; verify unit tests pass
- [ ] 1.5 Implement `content-selector.ts` (category toggles: playlists, metadata, thumbnails, history, settings) with tests proving excluded categories are absent and re-enabled ones return; verify unit tests pass
- [ ] 1.6 Keep every new file under 350 lines and document the module split; verify `npm run check` file-size gate passes

## 2. Sync engine and safety

- [ ] 2.1 Implement `sync-engine.ts` (debounced push, startup pull, manual sync, LWW by revision, CAS write guard, pre-import backup) depending only on injected interfaces; verify unit tests with fake backends cover all five behaviors
- [ ] 2.2 Implement `sync-settings.ts` (backend configs, content toggles, consent keys via existing settings store) with tests proving persistence and revocation; verify unit tests pass
- [ ] 2.3 Add pre-import backup slot creation before every import and a restore path from the Data Manager; verify a simulated failed import leaves local state intact (test)
- [ ] 2.4 Document the engine's conflict policy and safety net in the USER_GUIDE and the sync plan doc; verify the documented commands match actual behavior

## 3. Backend contract + File backend

- [ ] 3.1 Define `sync-backend.ts` (`SyncBackend` 3-method interface + `SyncBackendDescriptor`) and a backend registry; verify a lint/typecheck pass (`npm run check`)
- [ ] 3.2 Implement `backends/file-backend.ts` reusing the backup flow, with tests for export/import and wrong-key import failure; verify unit tests pass
- [ ] 3.3 Wire the File backend into the engine behind a module toggle (default off) and verify end-to-end: export, wipe, import restores state; verify `npm run test:extension` passes

## 4. Supabase bring-your-own backend

- [ ] 4.1 Add `supabase/migrations/` with the production schema from `packages/database/schema.sql` (minus demo tables) plus a deploy guide with a one-click deploy button; verify the migration applies cleanly on a fresh test project
- [ ] 4.2 Implement `backends/supabase-backend.ts` (Storage bucket `yph-sync`, object `sync/<hash>`, revision read-before-write) with tests using a fake Supabase client for upload/download/revision paths; verify unit tests pass
- [ ] 4.3 Wire Supabase BYO into the Plugins screen (URL + anon key setup, consent gate, enable toggle, invalid-config error path) and verify no traffic occurs when unconfigured (test); verify `npm run test:extension` passes

## 5. Google Drive backend

- [ ] 5.1 Implement `backends/drive-backend.ts` (`appDataFolder` via the existing Google OAuth flow, file named by storage hash, size guard) with tests using a fake Drive client; verify unit tests pass
- [ ] 5.2 Wire Drive into the Plugins screen with its own consent gate and authorization flow, including the Firefox Android fallback message (no OAuth popup); verify the Android guard path with a test
- [ ] 5.3 Verify the two-identity UX: YouTube sign-in and cloud sync remain separate, independent, default-off entries in the Connections screen; verify `npm run test:extension` route checks pass

## 6. Module registry and Plugins screen

- [ ] 6.1 Implement the module registry (`api-setup`, `data-manager`, sync backends) with persisted toggles and nav/route guards; verify toggling hides/shows entries and blocks direct routes (tests)
- [ ] 6.2 Add the Plugins entry to the sidebar footer (desktop + mobile drawer) opening `views/Plugins.svelte`; verify both surfaces render the module list and `npm run test:extension` viewport checks pass
- [ ] 6.3 Make API Setup a toggleable module keeping the missing-credential warning behavior when enabled; verify disable hides nav+route, enable restores both with the badge (tests)

## 7. Verification (Hermes executes; evidence required)

- [ ] 7.1 Run `npm run check` and record exact exit codes for lint, format, tests, file-size, svelte-check and gates
- [ ] 7.2 Run `npm run build` and record exact exit codes for Chrome/Firefox/Edge packages and bundle budgets
- [ ] 7.3 Run `npm run test:extension` and `npm --prefix apps/web-portal run build`; record exit codes
- [ ] 7.4 Two-device manual acceptance (owner or delegated real-device pass): sync phone ↔ laptop via File and at least one cloud backend, verify automatic push/pull, wrong-key safety and pre-import backup — leave unchecked until evidence exists
- [ ] 7.5 Firefox Android manual pass: confirm crypto runs, Drive shows the no-popup fallback, File backend works — leave unchecked until evidence exists

## 8. Retirement of the unwired plaintext engine

- [ ] 8.1 After 7.x acceptance, remove `supabase-sync.ts`/`supabase-client.ts` and their consent tests, and delete now-unused references; verify `npm run check` and `npm run build` still pass

## Workflow follow-up

- Archive the change only after tasks 7.4/7.5 evidence and the project's review requirements are complete.
- Release authorization and version bumps remain separate from this change.
- Record new suggestion ideas in `.ai-sync/PROGRESS.md` so they are never repeated.
