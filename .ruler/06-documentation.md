# Documentation Expectations

1. **Doc types.** Product docs live in `docs/` and must fit `architecture/`, `strategy/`, `execplans/`, `implementation/`, `observability/`, `voice/`, `reference/`, or a small set of top-level references (e.g. `alfred-prd.md`, `design-system.md`, `tailscale-api.yaml`).
2. **Planning docs.** Significant features and refactors use ExecPlans as defined in `.agent/PLANS.md`; long-lived planning docs belong in `docs/execplans/` only when the effort is cross-cutting or multi-phase.
3. **Transient notes.** Short-lived notes (spikes, scratchpads, one-off debugging) must either be merged into an ExecPlan or durable doc or deleted once the work is complete; do not leave orphan planning files.
4. **Naming.** Documentation filenames under `docs/` use lowercase kebab-case (or a single lowercase word) that reflects the domain or decision (e.g. `generative-ui-architecture.md`, `runtime-dashboard.md`).
5. **Structure.** Each doc starts with a `#` title matching the filename, a brief purpose/summary paragraph, and concise sections with bullets instead of long prose walls.
6. **ExecPlan format.** ExecPlans in `docs/execplans/` mirror the `.agent/PLANS.md` template with `Purpose`, `Plan`, `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` sections.
7. **Ownership.** Non-trivial docs name an owner or responsible area near the top (e.g. `Owner: cognition`, `Owner: infra`) so it is clear who maintains and deprecates them.
8. **Lifecycle.** When a doc becomes obsolete, either delete it as part of a cleanup or mark it `Deprecated` at the top and schedule removal; avoid conflicting or stale guidance.
9. **De-duplication.** Before adding a new doc, search `docs/` for related content and prefer extending or merging existing files over creating overlapping summaries.
10. **Env examples.** Keep `config/env.example` in sync with required variables. New secrets must be documented with purpose and default.
11. **Playbooks.** Record operational runbooks (db migrate, scheduler flags) in `docs/` so others can repeat the workflow without asking.
12. **READMEs.** Package-level READMEs state purpose, primary commands, and any gotchas (e.g. server-only modules, env requirements); avoid duplicating the same details in multiple docs.
13. **Changelogs.** For large changes or major doc reorganisations, summarise impact in `docs/changelog.md` (create once ready). Mention migrations, env changes, and user-facing effects.
14. **Ruler sync.** After editing documentation rules, run `bun run ruler:apply` to regenerate agent instructions before committing.
15. **Concise updates.** Prefer short, focused documentation updates and small rule additions over long summary documents; avoid generating large narrative reports of changes.

16. **ExecPlan status sync.** When verifying implementation status, systematically check the codebase and update ExecPlan status immediately. Also sync corresponding Linear issues. See `.ruler/32-execplan-verification.md` for detailed guidance.
