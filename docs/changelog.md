# Documentation Changelog

## 2025-11-26 — Documentation Expansion and Guides

- Created comprehensive developer guides:
  - `docs/guides/developer-onboarding.md` - Quick start, environment setup, common workflows
  - `docs/guides/cognitive-architecture.md` - End-to-end cognitive loop explanation
  - `docs/guides/linear-integration.md` - Linear OAuth/webhook setup and usage
  - `docs/guides/verification-patterns.md` - ExecPlan verification workflow
  - `docs/guides/common-patterns.md` - Code patterns and anti-patterns
  - `docs/guides/troubleshooting.md` - Common issues and solutions
- Added ExecPlan verification rules (`.ruler/32-execplan-verification.md`)
- Enhanced Drizzle patterns with bulk update optimization guidance
- Updated observability rules with metrics location guidance
- Updated testing rules with build verification CI guidance
- Updated documentation rules with ExecPlan status sync guidance

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
