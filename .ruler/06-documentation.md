# Documentation Expectations

1. **PRD updates.** When a capability lands, update `docs/alfred-prd.md` to reflect completion status and clarify partial coverage.
2. **Playbooks.** Record operational runbooks (db migrate, scheduler flags) in `docs/` so others can repeat the workflow without asking.
3. **Env examples.** Keep `config/env.example` in sync with required variables. New secrets must be documented with purpose and default.
4. **README hints.** Package-level READMEs should state purpose, primary commands, and any gotchas (e.g. server-only modules, env requirements).
5. **Changelogs.** For large changes, summarise impact in `docs/changelog.md` (create once ready). Mention migrations, env changes, and user-facing effects.
6. **Ruler sync.** After editing instructions, run `bun run ruler:apply` to regenerate agent-specific files before committing.
