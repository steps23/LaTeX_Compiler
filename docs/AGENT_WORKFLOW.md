# TeXForge Agent Workflow

Use this repository with VS Code, Codex and Git worktrees. Keep one prompt, one worktree and one implementing agent per task.

## Roles

- Planner: read-only analysis, no edits.
- Implementer: workspace-write, focused patch, targeted validation.
- Reviewer: read-only diff review, findings with file, line, severity and proposed fix.

Claude Code can be used as an optional independent reviewer for risky architecture, SQLite migrations, concurrency, threat modeling or large refactors. Do not let two agents write to the same worktree.

## Per-prompt flow

1. Start from a clean branch and current `main`.
2. Create a dedicated worktree for the prompt.
3. Run a read-only planning pass.
4. Implement only the approved phase.
5. Run targeted gates first, then required full gates.
6. Run independent review.
7. Commit only after the diff and gates are accepted.
8. Stop without starting the next prompt.

## Worktree example

```bash
git switch main
git pull --ff-only
git worktree add ../texforge-prompt-03 -b feat/prompt-03-tauri-foundation
code ../texforge-prompt-03
```

## Standard prompt template

```text
Work only in the current repository and worktree.

Before editing:
1. read applicable AGENTS.md files;
2. run git status;
3. read relevant docs and code;
4. verify real state instead of trusting documentation only;
5. show a brief file-by-file plan.

Exclusive objective:
[OBJECTIVE]

Implement only:
[REQUIREMENTS]

Do not:
[EXCLUSIONS]

Required checks:
[COMMANDS]

Acceptance criteria:
[CRITERIA]

At the end report:
- changed files;
- commands run;
- results;
- failed or skipped tests;
- residual risks.

Stop without starting the next phase.
```
