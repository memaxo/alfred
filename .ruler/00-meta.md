# Development Practices

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `.agent/PLANS.md`) from design to implementation. Create or refresh the plan before beginning, and maintain it as a living document by updating the `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` sections so a newcomer can complete the effort unaided.

## Deletion Safeguards

1. **Explicit deletion approval.** Never delete, rename to remove, or otherwise remove repository files, directories, or tracked artifacts unless the user explicitly instructs you to do so in this session. When a task appears to require removing something, pause and ask for confirmation instead. Honor existing untracked files; do not delete them unless the user orders it. Document any user-approved deletions in the final response.

2. **Empty directory cleanup.** Remove empty directories after deleting files. Empty directories indicate incomplete cleanup and should be removed to keep the codebase tidy.

## Ruler Maintenance

1. **Edit sources.** Modify rule markdown under `.ruler/` (or nested `.ruler/` folders). Generated files such as `AGENTS.md`, `.cursor/rules/*`, and `.aider.conf.yml` should never be edited manually.

2. **Apply on demand.** Run `bun run ruler:apply` after changing any rule file. This regenerates agent instructions and updates `.gitignore` entries.

3. **Verify in CI.** The `ruler:verify` script re-applies rules without touching `.gitignore` and fails if the repo becomes dirty. Hook it into GitHub Actions.

4. **Nested rules.** Package/app-specific rules live under `<package>/.ruler/`. They automatically merge with root guidance when Ruler runs with `--nested`.

## Rule Conciseness

1. **Keep rules short.** Each rule should be a single sentence or brief bullet point. Avoid verbose explanations, code examples, and reference sections that bloat AGENTS.md.

2. **No examples sections.** Remove code examples, migration checklists, file location lists, testing requirements, and related rules sections. Essential patterns can be mentioned inline within rules.

3. **Condense verbose rules.** When a rule exceeds 3 lines, break it into numbered sub-points or condense to essential information only.

4. **Remove redundancy.** If a concept appears in multiple files, consolidate it. Cross-reference only when necessary.

