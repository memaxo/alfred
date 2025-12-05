# Documentation Changelog

## 2025-12-05 — Explicit Memory Tools for Agent

- Implemented 8 explicit memory tools giving the agent direct control over the knowledge graph:
  - `memory_search` - Semantic search with on-the-fly query embedding
  - `memory_retrieve` - Get memory by ID with optional neighbor expansion
  - `memory_update` - Update confidence, properties, or label
  - `memory_remove` - Soft delete (archive) or hard delete
  - `memory_boost` - Reinforce memories by increasing confidence
  - `memory_traverse` - Walk knowledge graph with BFS or semantic DSA-BFS
  - `memory_history` - Review past conversation history
  - `memory_stats` - System health metrics and confidence distribution
- Added Prometheus metrics for memory tool operations:
  - `alfred_memory_tool_calls_total{tool, status}`
  - `alfred_memory_search_latency_seconds`
  - `alfred_memory_search_results_count`
  - `alfred_memory_traverse_depth`
  - `alfred_memory_boosts_total`
  - `alfred_memory_removals_total{type}`
- Created comprehensive unit tests (44 tests) in `packages/agent/test/tool/memory.test.ts`
- Updated `docs/guides/memory-system.md` with explicit memory tools documentation
- Updated `docs/alfred-prd.md` Phase 4.3 and Architecture Decision Log

## 2025-12-05 — VCR Integration Testing Infrastructure

- Created comprehensive VCR (Video Cassette Recorder) testing infrastructure for AI providers:
  - `packages/test-kit/src/vcr/` - Full VCR module with types, hashing, cassette I/O, and recorder
  - Supports OpenAI, Anthropic, Google, and Cohere providers
  - Automatic authorization header redaction for security
  - Request matching by hash with configurable matchers
- Added new integration tests with VCR recording:
  - `packages/api/test/integration/openai-vcr.integration.test.ts` - OpenAI API recording/replay
  - `packages/api/test/integration/workflow-pipeline.integration.test.ts` - Workflow streaming
  - `packages/api/test/integration/voice-pipeline.integration.test.ts` - Voice pipeline (local models)
  - `packages/api/test/integration/auth-flow.integration.test.ts` - Authentication flows
- Added Playwright E2E tests:
  - `apps/web/tests/auth.e2e.spec.ts` - 15 authentication tests
  - `apps/web/tests/workflow-execution.e2e.spec.ts` - 10 workflow UI tests
  - `apps/web/tests/settings.e2e.spec.ts` - 12 settings/preferences tests
- Added cassette validation script: `scripts/validate-cassettes.ts`
- Added new npm scripts:
  - `test:integration:full` - Run all integration tests
  - `test:vcr:record` - Run integration tests in VCR record mode
  - `test:vcr:validate` - Validate existing cassettes
- Updated CI pipeline (`.github/workflows/ci.yml`) with VCR validation and new test steps
- Added `consumeRouteRateLimit` backward compatibility function in `packages/api/src/trpc.ts`
- Created documentation: `docs/testing/vcr-integration-testing.md`

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
