# Development Practices

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `.agent/PLANS.md`) from design to implementation. Create or refresh the plan before beginning, and maintain it as a living document by updating the `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` sections so a newcomer can complete the effort unaided.

**Update cadence:** After completing each subtask or encountering a surprise, append to the relevant ExecPlan section immediately—before moving to the next subtask. Don't batch updates for the end.

## Scope Clarity

1. Always state whether a change targets ALFRED itself or the applications ALFRED generates so the two domains stay distinct in docs, plans, and code.
2. When describing workflows or runtime behavior, separate instructions for building ALFRED from steps ALFRED executes for end users, using explicit labels or sections.

## Workflow Runtime

1. Every workflow pipeline or orchestrator change must include tests that cover normal success, escalation, and MAX_TRANSITIONS safeguards so regressions surface immediately.
2. Phases that generate ExecPlan metadata must persist the root plan and every subtask skeleton under `.agent/plans/<runId>` before any agent launches.
3. Runtime components that observe agent progress must append Progress and Decision Log entries directly to the relevant ExecPlan files so humans can resume from the plan alone.

## Deletion Safeguards

1. **Explicit deletion approval.** Never delete, rename to remove, or otherwise remove repository files, directories, or tracked artifacts unless the user explicitly instructs you to do so in this session. When a task appears to require removing something, pause and ask for confirmation instead. Honor existing untracked files; do not delete them unless the user orders it. Document any user-approved deletions in the final response.

2. **Empty directory cleanup.** Remove empty directories after deleting files. Empty directories indicate incomplete cleanup and should be removed to keep the codebase tidy.

3. **Destructive commands.** Avoid running destructive shell or git commands (`rm -rf`, `git reset --hard`, force pushes, mass deletes) unless the risk is clearly low and intent is explicit.

## Ruler Maintenance

1. **Edit sources.** Modify rule markdown under `.ruler/` (or nested `.ruler/` folders). Generated files such as `AGENTS.md`, `.cursor/rules/*`, and `.aider.conf.yml` should never be edited manually.

2. **Apply on demand.** Run `bun run ruler:apply` after changing any rule file. This regenerates agent instructions and updates `.gitignore` entries.

3. **Verify in CI.** The `ruler:verify` script re-applies rules without touching `.gitignore` and fails if the repo becomes dirty. Hook it into GitHub Actions.

4. **Nested rules.** Package/app-specific rules live under `<package>/.ruler/`. They automatically merge with root guidance when Ruler runs with `--nested`.

## Rule Conciseness

1. **Keep rules short.** Use a single sentence or brief bullet. No examples, explanations, or checklists.
2. **Remove redundancy.** Consolidate concepts across files.
3. **Exception.** Snippets ≤ 5 lines allowed only for error-prone patterns.

## Code Search Tools

1. **Primary search.** Use `rg` as the default tool for searching across the codebase; fall back to `grep` only when `rg` is unavailable or unsuitable.

2. **AST-aware search.** Use `ast-grep` for syntax-aware or structural searches instead of composing complex regular expressions.

3. **File and tree discovery.** Use `fd` and `lsd` to discover files and directory structures before targeting searches or edits.

## Agent Collaboration

1. **Autonomous execution.** Execute tasks end-to-end (implement → test → fix → commit) without pausing for status updates or confirmations. See `.ruler/31-agent-autonomy.md` for full guidance.

2. **Shared branches.** The git worktree will be dirty from concurrent agents. Ignore files outside your task scope; only stop for direct conflicts with files you're editing.

3. **No confirmation loops.** If the user says "go" or "continue," execute all remaining steps. Never echo back recommendations the user already accepted.

## Database Operations

1. `bun scripts/migrate.ts --plan` applies pending migrations just like `db:migrate`, so run it only when you intend to write to the database.

2. Set `RUN_DB_TESTS=1` before invoking `bun test` on `packages/db` so Postgres-backed suites execute instead of skipping.
