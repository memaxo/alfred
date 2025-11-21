# Documentation Changelog

## 2025-11-21 — Documentation Cleanup and Canonicalization

- Established documentation rules in `.ruler/06-documentation.md` for doc types, naming, structure, ownership, and lifecycle.
- Expanded allowed doc buckets to include `docs/reference/` so API/SDK/third-party references live under a dedicated subtree instead of top-level sprawl.
- Confirmed the following as canonical docs and left them unchanged: `docs/alfred-prd.md`, `docs/design-system.md`, `docs/architecture/*.md` (except where noted), `docs/implementation/mindscape-v1-summary.md`, `docs/observability/runtime-dashboard.md`, `docs/execplans/*.md`, `docs/voice/*.md`, and `docs/tailscale-api.yaml`.
- Marked historical strategy and planning analyses as deprecated in favour of the Symbiotic Mindscape and UI testing ExecPlans:
  - `docs/architecture/server-entry-point-plan.md`
  - `docs/strategy/generative-ui-architecture.md`
  - `docs/strategy/generative-ui-recommendations.md`
  - `docs/strategy/ui-coverage-analysis.md`
  - `docs/strategy/ui-ux-comprehensive-strategy.md`
- Removed deprecated planning/strategy docs after confirming their content was either historical or fully captured in canonical references:
  - `docs/architecture/server-entry-point-plan.md`
  - `docs/strategy/generative-ui-architecture.md`
  - `docs/strategy/generative-ui-recommendations.md`
  - `docs/strategy/ui-coverage-analysis.md`
  - `docs/strategy/ui-ux-comprehensive-strategy.md`
- Updated `docs/execplans/runtime/runtime-integration-analysis-checklist.md` to treat `docs/alfred-prd.md` as the canonical source of priority development goals instead of the non-existent `docs/next-priorities.md`, and to reference the Linear ExecPlan for runtime-related Linear context.
