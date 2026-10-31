# OpenSpec in this project

OpenSpec CLI 1.16.0 was installed as `/home/steve/.local/bin/openspec` using the official
standalone installer with release checksum verification. No app dependency or lockfile
was changed by setup. The official setup reference is https://openspec.dev/docs/setup.

## Sources of truth

- `AGENTS.md`: project rules; `.ai-sync/AGENT_WORKFLOW.md`: evidence/handoff standard.
- `openspec/config.yaml`: short project context and workflow rules.
- `openspec/changes/<name>/`: proposal, behavior specifications, design and tasks for an open change.
- `openspec/specs/`: accepted requirements after completed changes are archived; initially empty.
- `.ai-sync/HANDOFF.md` and `PROGRESS.md`: current state/evidence, linking the active change.
- Existing detailed plans/browser checklists remain referenced; do not duplicate or silently replace them.

Current change: `complete-context-menu-acceptance`. Its planning artifacts are written;
its acceptance tasks remain open. This imports existing scope, not release authorization.

## Using it

Restart Codex/Hermes to discover the generated skills. On Codex desktop, select the
OpenSpec skill from Skills if typing a skill name does not resolve it.

| Action                          | Codex                                                     | Hermes                                                    |
| ------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Explore an idea                 | `$openspec-explore`                                       | `/openspec-explore`                                       |
| Draft a change                  | `$openspec-propose`                                       | `/openspec-propose`                                       |
| Work through an existing change | `$openspec-apply-change complete-context-menu-acceptance` | `/openspec-apply-change complete-context-menu-acceptance` |
| Revise the plan                 | `$openspec-update-change`                                 | `/openspec-update-change`                                 |

Plain-language requests also work: "Use OpenSpec to work on complete-context-menu-acceptance;
read the handoff first and leave test execution to Hermes."

Useful CLI commands:

```bash
openspec list
openspec status --change complete-context-menu-acceptance
openspec validate --all --strict --no-interactive
openspec update
```

Validation checks OpenSpec files, not application correctness or browser acceptance.
Planning complete does not mean tasks complete. Do not archive unfinished work.
Run `openspec update` when intentionally refreshing generated workflows; review its diff.

## Another machine or coding agent

Install the CLI using the official installation docs, then run `openspec init --tools
codex,hermes --profile core --no-animation` from this repository. Additional tool IDs can
be selected later using init. Preserve existing config and review generated changes.

Hermes needs this repository's absolute `.hermes/skills` directory in
`skills.external_dirs` in its user config. This machine is configured; another clone
or moved checkout needs its own path. Never copy the entire user config into the repo.
A private backup of the pre-setup config remains beside the original on this machine.

Generated OpenSpec SKILL.md files are versionable through narrow `.gitignore`
exceptions; other agent state stays ignored. Global CLI binaries and user configs are
not committed. Keep owner verification delegation and release restrictions effective
regardless of which agent invokes the workflow.

## Separate implementation worktrees

Use one worktree per independent OpenSpec implementation change and reuse it for
resumed work. Record its absolute path, branch, base ref/starting commit and owners
in `.ai-sync/templates/TASK.md`. Ensure the approved change, instructions and required
code are present in that commit before starting. Uncommitted/untracked artifacts in
another checkout are not automatically included; preserve them and establish an
appropriate authorized prerequisite snapshot first.

Start Codex/Hermes in the selected worktree. Keep one writer there; a reviewer can
inspect it read-only against a stable snapshot, and the designated verifier takes its
turn when installation/build commands would write files. Parallel implementations
use different branches/worktrees. Use app-managed worktree lifecycle tools when
available instead of manually deleting folders.

Tracked OpenSpec files follow the selected commit. Dependencies, ignored local config,
generated builds and service ports need checkout-specific setup. Check Hermes skill
discovery for that worktree's `.hermes/skills` path; never copy the whole user config or
secrets into the repo. Separate trees still need conflict review and verification after
integration. Retain the worktree/evidence until authorized cleanup is safe.

The full policy is `.ai-sync/AGENT_WORKFLOW.md`; implementation and review prompts are
in `.ai-sync/START_HERE.md`. Templates remain blank; record actual paths/results only
in session copies. Existing acceptance tasks and owner verification delegation remain
unchanged by this documentation update.

## Skills beyond OpenSpec

Follow the skill-selection rule in AGENTS.md and .ai-sync/AGENT_WORKFLOW.md for each
task. OpenSpec organizes the change; other relevant skills can support implementation,
review or verification. Load only what the current task needs, and reassess when scope
changes. Do not install every skill or edit generated OpenSpec skills to duplicate this rule.

Agents have different skill catalogs and discovery paths. Record the skills actually
read, their source paths and missing-skill fallbacks in session records. An OpenSpec
command does not itself prove that another skill was available or followed. Skills
preserve the existing verification delegation, scope and release restrictions.

## Parallel orchestration plan

`orchestrate-parallel-implementations` plans a coordinator registry, two-job scheduling,
worktree/agent adapters, revision-bound evidence and push-then-PR publication. Read
`docs/AI_ORCHESTRATION.md` for the operational policy. Its runtime tasks are not yet
implemented; no automatic dispatcher or merger is running. Default merging is manual.
The separate `complete-context-menu-acceptance` change retains its existing work.
