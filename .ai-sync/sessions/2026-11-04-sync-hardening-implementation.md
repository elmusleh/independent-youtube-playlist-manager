# Task brief — harden encrypted sync v2

- Date: 2026-11-04
- Request/source: Owner approved implementing all recommendations from the fresh audit.
- Implementer: Hermes (OpenAI Codex)
- Reviewer: Owner / independent review pending
- Verification owner: Hermes; manual real-device acceptance remains owner-gated
- Repository root (absolute path): `/home/steve/dev/independent-youtube-playlist-manager`
- OpenSpec change/path: `openspec/changes/add-encrypted-cross-device-sync/` (related proposal; current v2 implementation has diverged, do not mark its tasks accepted from this work)
- Worktree mode and reason: Current checkout, explicitly continuing the existing owned feature branch; no separate writer.
- Assigned worktree (absolute path): `/home/steve/dev/independent-youtube-playlist-manager`
- Worktree manager and identifier: N/A
- Branch, base ref and starting commit: `feat/sync-hardening`, starting at `c6607ba`; `origin/feat/sync-hardening` at `a86413b`; local branch ahead by 73 commits.
- Prerequisite snapshot and proof required code/plans are present: fetched remotes; current checkout contains sync v2 code, relay SQL, Compose fixture and CI workflow.
- Existing local changes to preserve: None at start (clean tree).

## Orchestration assignment

- Job ID and coordinator: Manual owner request in this conversation; no parallel jobs.
- Dispatch adapter/capability: Direct implementation in this checkout.
- Dependency jobs and overlapping areas: One writer; implementation spans engine/adapters, relay SQL/tests, Compose/CI and status-store.
- Remote, target branch and last synchronized base SHA: PR #88 targets `next`; remote PR head is stale at `a86413b`.
- Allowed commit/push/PR actions and authorization source: Local implementation and local verification only. No commit, push, PR update, merge, deployment, release or public action was authorized.
- PR URL/number and published head SHA: https://github.com/elmusleh/independent-youtube-playlist-manager/pull/88; remote head `a86413b`.
- Merge mode and authority source: Manual; no merge authority.
- Pending CI/review/manual acceptance gates and next actor: Re-run CI after an authorized push; owner/real device must perform Chrome/Firefox/Fenix acceptance; hosted migration requires separate explicit approval.

## Skill selection

- Relevant skills selected and purpose: `encrypted-cross-device-sync` for the v2 protocol and audit checklist; `test-driven-development` for regressions; `incremental-implementation` for thin verified slices; `verification-before-completion` for scoped evidence.
- SKILL.md source paths / versions: `/home/steve/.hermes/skills/encrypted-cross-device-sync/SKILL.md` v1.4 and `references/review-checklist.md`, `references/relay-v2-protocol.md`; `/home/steve/.hermes/skills/software-development/test-driven-development/SKILL.md` v1.1; `/home/steve/.hermes/skills/software-development/incremental-implementation/SKILL.md` v1.0; `/home/steve/.hermes/skills/software-development/verification-before-completion/SKILL.md` v1.0.
- Required skills unavailable and fallback: None.
- Material instruction conflicts and resolution: AGENTS.md says every session ends with a commit; higher-priority coding guidance says do not commit unless asked. No commit/push/merge will be done absent explicit authorization. No hosted DB migration will be applied.
- Scope changes requiring reassessment: If a safe rate limiter requires provider-specific gateway configuration or real-device action, leave it documented and pending rather than guessing or touching production.

## Objective and approved scope

Implement the audit recommendations on the existing sync v2 branch: make adapter/engine behavior type-safe and tested; fix dirty-shadow acknowledgements, conflict/retry, collection cursors and tombstones; harden relay validation/rate limits; make local relay E2E fixture repeatable and run it in CI; complete or accurately scope restore/status behavior; align current docs and evidence.

## Acceptance criteria

- [ ] `svelte-check` has zero errors and production build fails on compiler errors.
- [ ] Real `runAdapterPass`/adapter tests prove encryption, storage mutation, retry/acknowledgement, remote deletion, disabled-then-enabled backfill and failure-safe cursors.
- [ ] Per-record push `ok` is the only path that acknowledges a dirty shadow; conflicts/errors/network failures remain retryable and are surfaced.
- [ ] Tombstones preserve delete-vs-edit policy, are applied atomically, do not resurrect records and stop retransmitting after acknowledgement.
- [ ] Relay SQL rejects malformed records per-record without rolling back valid siblings; far-future server rejection, auth-before-limiter and HTTP 429 are tested against PostgREST.
- [ ] Compose fixture starts from clean state with pinned images, health checks, correct roles/ports; CI explicitly runs the relay E2E suite.
- [ ] Restore/run-history UX either has an actual consumer and tests or the unsupported claims are removed; no dead pending-restore marker is presented as functional restore.
- [ ] Run and record project quality/build gates and extension test where feasible; state any manual or hosted verification not run.
- [ ] Update current handoff/progress once at stop; keep OpenSpec tasks unchecked unless their exact scope and evidence are met.

## Constraints and explicit exclusions

- Do not read/write secrets, or restore credential values from prior output.
- Do not apply migrations to hosted Supabase or change production state. Migration authoring and local disposable DB testing are allowed.
- Do not push, update the PR, merge, publish, deploy, bump versions or release.
- Do not claim local automated tests are real-device acceptance.

## Relevant plan, source and documentation

- `AGENTS.md`, `.ai-sync/AGENT_WORKFLOW.md`, `openspec/README.md`, `openspec/config.yaml`
- `docs/SYNC_V2_STATUS.md`, `docs/SYNC_DESIGN_ALIGNMENT_PLAN.md`, `docs/sync-relay-v2.sql`, `docs/migrations/`
- `apps/browser-extension/playlist-manager/src/services/sync-engine.ts`, `sync-engine-adapters.ts`, `sync/adapters/*`, `sync/shadow-store.ts`, `sync/relay-transport.ts`, `sync/status-store.ts`, `sync/e2e-relay.test.ts`
- `docker-compose.test.yml`, `.github/workflows/ci.yml`, root `package.json`

## Workspace preparation and coordination

- Prerequisite/uncommitted-work handling: Confirmed clean start; no stash/reset/switch.
- Dependency setup and local configuration: Existing locked npm dependency trees; no credentials.
- Service ports and test data: Disposable local Postgres/PostgREST only; use fixture-only identifiers.
- Agent/OpenSpec skill discovery: Loaded sync-specific checklist and protocol reference; no unrelated OpenSpec change is being executed.
- Parallel work: None; one writer in current checkout.
- Handoff/cleanup: Release the repository editing lock and remove only this run's disposable test containers/networks.

## Intended changes

Implement as small behavior slices: establish engine/adapter test harness; fix acknowledged-shadow and remote-apply contracts; introduce safe per-collection cursors and tombstone behavior; harden SQL and schema migration with direct PostgREST evidence; repair Compose/CI; wire or narrow status/restore claims; update project handoff/status at stop.

## Verification plan or delegation

| Requirement                          | Check/evidence needed                                                                           | Responsible agent/person | Status                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------ | ------------------------ |
| TypeScript and unit suite            | `npx svelte-check`, `npm run test`                                                              | Hermes                   | Pending                  |
| Adapter/engine behavior              | Focused Vitest using fake IndexedDB and real modules; RED/GREEN regressions                     | Hermes                   | Pending                  |
| Relay SQL                            | Compose health check + real PostgREST E2E including malformed batch, auth flood and HTTP status | Hermes                   | Pending                  |
| CI fixture integration               | Inspect workflow, run equivalent local commands                                                 | Hermes                   | Pending                  |
| Full project gates                   | `npm run check`, `npm run build`, `npm run test:extension`                                      | Hermes                   | Pending                  |
| Real user devices / hosted migration | Chrome/Firefox/Fenix acceptance; staging/production migration as separately approved            | Owner                    | Pending / not authorized |

## Assumptions and open questions

- User's “do them all” authorizes local implementation of the prior audit recommendations, not external publication or production writes.
- SQL cannot safely infer a trusted client IP by itself; do not trust caller-supplied forwarding headers. If IP-based abuse protection is needed, document the required trusted provider/gateway control instead of pretending a per-space RPC counter solves global abuse.

## Completion decision and supporting evidence

Pending implementation and fresh verification. Starting SHA: `c6607ba`; tree clean; PR #88 still targets `next` at older remote head `a86413b` and remains blocked. The prior baseline audit at this same SHA found `svelte-check` failure, build diagnostics despite exit 0, a failing Compose startup, and relay E2E passing only when a manually provisioned local service was available.
