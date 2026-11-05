# Parallel orchestration planning: 2026-10-31

Owner requested the semi-automatic agent/worktree/PR workflow and an implementation plan.
Used `.agents/skills/openspec-propose/SKILL.md` to create planning artifacts only.

Delivered change `orchestrate-parallel-implementations` and `docs/AI_ORCHESTRATION.md`,
with links/policy in AGENTS.md, workflow/prompts/templates and .ai-sync records. No
runtime or application code implemented. No agents/worktrees launched, commits/pushes,
PR creation/merge, settings changes or release actions performed. Existing local work
and separate context-menu acceptance state were preserved.

Direct setup/documentation evidence (repository root):

| Command                                                       | Exit | Result                                                             |
| ------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| openspec validate --all --strict --no-interactive             | 0    | Two changes passed, zero failed                                    |
| openspec status --change orchestrate-parallel-implementations | 0    | Four planning artifacts complete                                   |
| openspec list                                                 | 0    | New change has 0/21 tasks; existing acceptance change remains 0/14 |

Default merge policy is manual. Optional guarded mode is planned behind separate
recorded owner opt-in and current checks/review/manual/protection gates. Conflict-free
alone is insufficient. Actual dispatch requires a supported authorized adapter; otherwise
handoff stays pending. Prepare a scoped reviewed committed starting snapshot before
worker trees depend on currently uncommitted/untracked files.

Next: review the artifacts, then apply the named change when implementation is requested.
Hermes owns execution of the planned tests/builds/audits unless reassigned. OpenSpec
validation above is not runtime verification or authorization to archive/merge/release.
