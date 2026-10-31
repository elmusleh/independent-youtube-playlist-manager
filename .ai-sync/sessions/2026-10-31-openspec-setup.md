# OpenSpec setup — 2026-10-31

Owner requested installation/adoption for switching AI agents. Installed official
standalone CLI 1.16.0; initialized six core skills each for Codex and Hermes. Enabled
Hermes project skill lookup with a private config backup. Added narrow Git exceptions,
project context/rules, usage guide and the existing acceptance plan as an open change.
Preserved newer protocol edits found during setup; did not modify product code or dependencies.

Setup evidence (repository root, directly executed):

| Command/inspection                                               | Exit | Observed result                                                          |
| ---------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| Official standalone installer                                    | 0    | Release checksum verified; CLI installed in ~/.local/bin, version 1.16.0 |
| openspec init --tools codex,hermes --profile core --no-animation | 0    | Six workflows generated per agent                                        |
| openspec validate --all --strict --no-interactive                | 0    | One change passed; zero failed                                           |
| openspec status --change complete-context-menu-acceptance        | 0    | Four planning artifacts complete                                         |
| openspec list                                                    | 0    | Active change has 0/14 acceptance tasks complete                         |
| Git/Hermes configuration inspection                              | 0    | Generated skill files visible to Git; Hermes skill path configured       |

OpenSpec validation is not application verification. No app tests, builds or audits
executed. Those remain delegated to Hermes. No merge, archive, release or publication.
Next: restart agents, read openspec/README.md, then follow the active change after rereading
current source and .ai-sync state. Keep all acceptance tasks pending until evidenced.
