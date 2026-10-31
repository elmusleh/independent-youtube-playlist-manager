# Tasks

These tasks import the existing unfinished acceptance work. All remain unchecked until
current-tree evidence is reviewed; the setup does not rerun or certify application tests.
Implementation/review: assigned agent. Application verification: Hermes unless reassigned.

## 1. Protocol correctness

- [ ] 1.1 Review current shared/background declarations against JavaScript and existing fixes; deliver a contract comparison identifying unsupported operations, return envelopes, job states and nullable fields.
- [ ] 1.2 Repair confirmed mismatches without duplicating model types or hiding errors with casts; add focused positive/negative contract coverage and document any generation command with inspectable output.
- [ ] 1.3 Have Hermes run the contract coverage and relevant check/build gates sequentially; record commands, exit codes and tested tree identity in a verification record.

## 2. Dependency findings and accurate evidence

- [ ] 2.1 Inspect current lockfiles and audit evidence, including follow-redirects via http-proxy; deliver the direct/transitive and shipped/build/server reachability assessment in dependency triage documentation.
- [ ] 2.2 Apply compatible remediation for confirmed findings using the approved npm version; document residual findings and verify the lockfile diff preserves unrelated dependency/release edits.
- [ ] 2.3 Have Hermes rerun all six audit views and affected gates; retain actual exit codes and confirm a high finding cannot be labelled a passing full audit.

## 3. Browser and issue acceptance

- [ ] 3.1 Have Hermes run the headed portal/extension E2E suite with HEADED=true and Xvfb or a suitable display; record executed/skipped counts and require the mandatory extension cases to execute.
- [ ] 3.2 Complete the real Chrome native-menu fixture flow and activeTab import using a disposable profile; record browser/artifact identity, steps and expected three unique IDs.
- [ ] 3.3 Complete the corresponding real Firefox native-menu flow using a disposable profile; record separate evidence rather than inferring it from Chromium or handler tests.
- [ ] 3.4 Execute the remaining contexts/scopes/settings/concurrency/restart/closing/import cases from docs/testing/HERMES_CONTEXT_MENU_VERIFICATION.md; fix confirmed defects with focused regression coverage and retain per-case results.
- [ ] 3.5 Verify #10/#11/#13/#14 with recorded evidence for narrow pagination, preserved thumbnails, first paint and duration fetching; leave issue closure to applicable owner authorization.
- [ ] 3.6 Record real-device/Android and remote-account checks separately; obtain only any missing account authorization needed for live mutations and leave unavailable cases explicitly pending, not passed.

## 4. Acceptance handoff

- [ ] 4.1 Have Hermes repeat only the integration checks invalidated by fixes; link final tree/artifact identities and exact results, with no stale successful evidence attributed to changed code.
- [ ] 4.2 Reconcile this task list with .ai-sync/HANDOFF.md and PROGRESS.md; deliver an acceptance decision listing every unresolved risk, skipped case and remaining owner action.

## Workflow follow-up

- Archive only after the change's acceptance evidence is complete; archive is not a release.
- Do not merge, publish, deploy, change versions or close issues without applicable owner authority.
