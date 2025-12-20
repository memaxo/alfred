# Linear Audit Follow-ups: Duplicates, Metadata, Tooling, and Metrics

This ExecPlan is a living document. Maintain it per `.agent/PLANS.md`; keep Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective current after every subtask. Scope clarification: every activity here targets ALFRED itself (Linear workflows, runtime tooling, documentation), not the downstream apps ALFRED generates.

## Purpose / Big Picture

The January 27 Linear audit surfaced board hygiene gaps (duplicate tickets, missing estimates/labels), CI blockers (Biome backlog, absent Codex SDK + Playwright harness), and observability blind spots (preview cleanup monitoring, Linear rate-limit metrics). Completing these follow-ups ensures Linear reflects reality so auditors can close the review, restores lint/test velocity so CI can trust `bun run lint` and Playwright suites, proves the preview cleanup worker is running, and surfaces rate-limit telemetry for future throttling analysis. Once finished, a reviewer can: (1) open Linear and see duplicates closed plus consistent metadata, (2) run `bun run lint` or targeted Biome checks without 885 critical findings, (3) execute the full Codex + Playwright-based test matrix locally, (4) tail API logs to watch `worktree_preview_cleanup_*` activity, and (5) scrape Prometheus to observe new `linear_rate_limit_*` counters/histograms.

## Progress

- [x] (2025-11-27 07:20Z) Drafted this ExecPlan to coordinate all post-audit follow-ups.
- [ ] Close ALF-75 and ALF-77 via Linear UI per `docs/reports/duplicate-issues-closure.md`, add cancellation comments, and record completion in `docs/reports/linear-issues-fixes-2025-01-27.md`.
- [ ] Normalize estimates, labels, statuses, and cycles for the audited issues (ALF-70, ALF-134, ALF-91, ALF-9/10/11/72/75/79) referencing `.ruler/24-linear-integration.md`; export before/after snapshots under `tmp/linear-metadata-*.json`.
- [ ] Triage Biome lint backlog: capture baseline (`bun run lint --reporter summary`), prioritize unused imports + `noConsole`, implement quick fixes, and log residual counts in a new `docs/reports/biome-lint-triage-2025-11-27.md`.
- [ ] Install and validate Codex CLI + Playwright harness assets (`codex --version`, `bunx playwright install --with-deps chromium`), document credentials/env requirements in `config/env.example`, and run smoke Playwright suites gated behind proper env flags.
- [ ] Monitor preview cleanup loop in lower environments: run API with shortened `WORKTREE_PREVIEW_CLEANUP_INTERVAL_MS`, capture log excerpts for `worktree_preview_cleanup_*`, and tweak interval/env docs if logs stay silent.
- [ ] Add/verify Linear rate-limit metrics wiring: ensure `packages/api/src/metrics.ts` registers counters/histograms, `packages/agent/src/orchestrator/linear-rate-limiter.ts` increments them, and extend tests to assert metric interactions.
- [ ] Update `docs/reports/linear-issues-fixes-2025-01-27.md` to document lint/test limitations plus remediation evidence collected in this pass (baseline counts, toolchain installs, preview cleanup observations).

## Surprises & Discoveries

- Pending once implementation work uncovers unexpected behaviors.

## Decision Log

- Decision: Treat the seven follow-ups from `docs/reports/linear-issues-fixes-2025-01-27.md` as a single coordinated effort instead of ad-hoc tasks so audit closure evidence lives in one place.  
  Rationale: These items share dependencies (Linear CLI access, lint tooling, metrics) and auditors require a contiguous narrative.  
  Date/Author: 2025-11-27 / codex-linear-audit-followup

## Outcomes & Retrospective

To be completed after implementing the tasks; will summarize which audit gaps closed, remaining risks, and validation artifacts.

## Context and Orientation

- **Linear duplicate closure**: `docs/reports/duplicate-issues-closure.md` lists ALF-77 → ALF-131 and ALF-75 → ALF-79 as duplicates with prescribed cancellation comments and statuses. `scripts/close-duplicate-issues.sh` provides CLI guidance but does not actually hit the API. Manual UI steps are still required because API automation already flagged them as duplicates yet UI status remains “Duplicate”.
- **Metadata normalization**: `docs/reports/linear-issues-audit-2025-01-27.md` (Medium-Priority Findings #21–23) enumerates missing estimates (ALF-70, ALF-134, ALF-91), inconsistent labels (ALF-9/10/11 missing "infrastructure", ALF-72 lacking "tools", ALF-75/79 needing alignment), and mismatched projects. `.ruler/24-linear-integration.md` mandates Fibonacci estimates, dependency links, and consistent cycles. We must use the Linear web UI or CLI to update issues, then record the outcome.
- **Biome lint backlog**: `docs/reports/linear-issues-fixes-2025-01-27.md` notes ~885 Biome findings blocking `bun run lint` with emphasis on unused imports, console usage, and formatting noise. `biome.json` is configured via `ultracite` presets, and root scripts expose `bun run lint` (alias for `bunx biome check .`). We can target rules via `--only` flags (`biome check --only suspicious/noConsole`).
- **Codex CLI + Playwright harness**: `packages/agent/src/orchestrator/tool/codex/exec.ts` runs the Rust `codex` CLI (`codex exec --json`) and requires `CODEX_API_KEY` (or `OPENAI_API_KEY` when `ORCH_CODEX_ALLOW_OPENAI_KEY=1`). Playwright tests (apps/web/playwright.config.ts) rely on `bunx playwright test` and require Chromium browsers installed via `bunx playwright install`. Missing dependencies can force CI to skip large suites.
- **Preview cleanup monitoring**: `packages/api/src/init.ts` boots a cleanup loop calling `flushPreviewCleanupBacklog`. Logs `worktree_preview_cleanup_startup`, `_interval`, `_interval_failed`, and `_interval_started` confirm activity. The interval duration defaults to 5 minutes but respects `WORKTREE_PREVIEW_CLEANUP_INTERVAL_MS`. Evidence is required that logs fire in staging/lower envs; if not, the interval or root path must be adjusted.
- **Linear rate-limit metrics**: `packages/api/src/metrics.ts` defines counters/histograms (`linear_rate_limit_total`, `_wait_seconds`, `_retry_after_total`), but we must ensure they’re exported, registered once, and used by `packages/agent/src/orchestrator/linear-rate-limiter.ts` and tests to provide telemetry on throttling. The limiter currently lazily `require`s `@alfred/api/metrics`—we need to confirm this path works in server contexts and add deterministic test coverage.
- **Documentation updates**: `docs/reports/linear-issues-fixes-2025-01-27.md` already mentions lint/test blockers under “Known Limitations”, but auditors need refreshed data (actual counts fixed, outstanding suites, preview-monitor results) to close ALF-138. All updates must distinguish between ALFRED runtime behavior and generated-app behavior.

## Plan of Work

1. **Close duplicate Linear issues**: Follow `docs/reports/duplicate-issues-closure.md`. Use the Linear UI (preferred) or CLI to cancel ALF-77 and ALF-75 as duplicates, set status to “Canceled”, add comments referencing surviving tickets (ALF-131, ALF-79), and link duplicates. Capture screenshots or CLI output for the audit trail. Update `docs/reports/linear-issues-fixes-2025-01-27.md` under “Linear Issue Updates” confirming closures.
2. **Normalize metadata**: Export the current Linear issue list (either via Linear CLI `linear issue list --team "Alfred-ops" --json` or GraphQL API) into `tmp/linear-metadata-before.json`. Update estimates (Fibonacci) and labels in UI for ALF-70, ALF-134, ALF-91, ALF-9, ALF-10, ALF-11, ALF-72, ALF-75, ALF-79. Align projects/cycles as recommended. Export updated data into `tmp/linear-metadata-after.json` and summarize changes in the report. Ensure due dates align with cycle end for urgent tickets.
3. **Biome lint triage**: Run `bun run lint --reporter summary` (or `bunx biome check --reporter json`) to capture current counts in `test-results/biome-lint-baseline.json`. Use targeted commands (`bunx biome check --write "packages/**/*.ts" --only style/noUnusedVariables`, `rg --files -g"*.ts" | xargs ...`) to address unused imports and `console.*` uses in priority packages. Document paths touched plus before/after counts in `docs/reports/biome-lint-triage-2025-11-27.md`. For remaining debt, open/annotate Linear issues (e.g., ALF-137 sub-tasks) with newly captured statistics.
4. **Install Codex CLI + Playwright harness**: Verify `codex` presence via `codex --version` (or set `CODEX_BIN`). Update `config/env.example` with any new env vars needed (`CODEX_API_KEY`, `PLAYWRIGHT_SKIP_WEB_SERVER`). Run `bunx playwright install --with-deps chromium` so tests have browsers. Execute smoke Playwright suite (`bunx playwright test --config apps/web/playwright.config.ts --project=smoke`) and targeted Codex tests (`bun test packages/agent/test/codex-exec.test.ts`) to confirm harness works; record any blocked suites and missing credentials.
5. **Monitor preview cleanup loop**: Start the API (`WORKTREE_PREVIEW_CLEANUP_INTERVAL_MS=60000 turbo run dev --filter=@alfred/api`) with logging level info. Tail logs for at least two cycles to confirm `worktree_preview_cleanup_interval` messages appear, documenting timestamps/cleaned counts. If logs do not appear, inspect `packages/agent/src/orchestrator/tool/worktree.ts` for pending backlog and adjust env (e.g., `WORKTREE_PREVIEW_CLEANUP_ROOT`). Update doc describing recommended interval per environment.
6. **Add Linear rate-limit metrics**: Ensure `packages/api/src/metrics.ts` exports the counters/histogram and that the API registers them once (dedupe patch already present). In `packages/agent/src/orchestrator/linear-rate-limiter.ts`, confirm `getLinearRateLimitMetrics` wires the counters. Add unit tests (e.g., `packages/agent/test/orchestrator/linear-rate-limiter.test.ts`) that mock metrics to assert `.inc`/`.startTimer` usage when throttling occurs. Update any relevant docs referencing metrics (maybe `docs/reports/linear-issues-fixes-2025-01-27.md` under Observability).
7. **Document lint/test limitations**: After steps 3–5, refresh `docs/reports/linear-issues-fixes-2025-01-27.md` Known Limitations with new lint counts, which suites remain blocked, the status of Codex SDK/Playwright install, and preview cleanup evidence. Include explicit dates and attach references to new triage doc plus log snippets so auditors can trust the summary.

## Concrete Steps

- `cd /Users/jackmazac/Development/alfred`
- Close duplicates via Linear UI or CLI (`linear issue update ALF-77 --state "Canceled" --description "Duplicate of ALF-131"`), then record results in docs.
- `linear issue list --team "Alfred-ops" --json > tmp/linear-metadata-before.json`
- After metadata edits: `linear issue list --team "Alfred-ops" --json > tmp/linear-metadata-after.json`
- `bun run lint --reporter summary > test-output/biome-lint-baseline.txt`
- `bunx biome check --write packages --only style/noUnusedVariables`
- `rg -n "console\." apps packages | tee test-output/console-usages.txt`
- `bunx biome check --apply-unsafe src` (targeted directories) to fix formatting noise once critical violations resolved.
- `codex --version`
- `bunx playwright install --with-deps chromium`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 bunx playwright test --config apps/web/playwright.config.ts --project=smoke`
- `bun test packages/agent/test/codex-exec.test.ts`
- `WORKTREE_PREVIEW_CLEANUP_INTERVAL_MS=60000 NODE_ENV=development turbo run dev --filter=@alfred/api`
- `rg -n "worktree_preview_cleanup" logs/dev.log > test-output/preview-cleanup.log`
- `bun test packages/agent/test/orchestrator/linear-rate-limiter.test.ts`
- Update docs: `docs/reports/linear-issues-fixes-2025-01-27.md`, add new report `docs/reports/biome-lint-triage-2025-11-27.md`.

## Validation and Acceptance

- **Duplicates**: Linear UI shows ALF-77 and ALF-75 in “Canceled” status with duplicate links; `docs/reports/linear-issues-fixes-2025-01-27.md` updated accordingly.
- **Metadata**: `tmp/linear-metadata-after.json` reflects added estimates, labels, due dates, and cycle assignments; summary recorded in report.
- **Lint**: `bun run lint --reporter summary` output after quick fixes shows a materially reduced count (documented in triage report) and zero high-priority (unused import / console) violations on touched files.
- **Toolchain**: `codex --version` confirms installation, Playwright smoke project passes locally, and doc updates explain any remaining blocked suites.
- **Preview cleanup**: Captured logs show at least one `worktree_preview_cleanup_interval` entry with `cleaned > 0` or `cleaned: 0 but interval logged`, plus explanation of interval adjustments.
- **Metrics**: Unit tests covering `linear-rate-limiter` pass and assert metric increments; Prometheus `/api/metrics` output includes `linear_rate_limit_total`, `linear_rate_limit_wait_seconds_bucket`, and `linear_rate_limit_retry_after_total` after starting API locally.
- **Documentation**: `docs/reports/linear-issues-fixes-2025-01-27.md` and the new lint triage doc describe limitations, remediation progress, and outstanding risks with dates.

## Idempotence and Recovery

- Linear UI operations are idempotent: re-closing an already canceled issue is a no-op. Always verify status after submission.
- Biome commands can be rerun safely; keep patches small and commit incrementally to avoid losing context if fixes need rollback.
- Playwright/Codex installs can be rerun; the commands overwrite existing binaries. Record versions in the triage doc.
- Preview cleanup monitoring can be repeated by restarting the API with the same env vars; ensure interval timers are cleared via `Ctrl+C` so `worktree_preview_cleanup_interval_stopped` logs appear.
- Metrics tests use mocked registries; rerunning them does not mutate global state thanks to the dedupe guard in `packages/api/src/metrics.ts`.

## Artifacts and Notes

- Store Linear CLI exports under `tmp/linear-metadata-before.json` and `tmp/linear-metadata-after.json` (git-ignored) and reference their hashes in the report.
- Save Biome baseline output under `test-output/biome-lint-baseline.txt` plus any filtered rule reports for future comparison.
- Capture preview cleanup logs in `test-output/preview-cleanup.log` and embed excerpts in docs.
- Document Playwright/Codex install logs (versions, directories) in `docs/reports/biome-lint-triage-2025-11-27.md` or the audit report as supporting evidence.

## Interfaces and Dependencies

- **Linear CLI / API**: Required for closing issues (`linear issue update <ID> ...`) and exporting metadata. Ensure `LINEAR_API_KEY` is set in the shell.
- **Biome CLI (`bunx biome`)**: Primary lint command; use `--reporter json`, `--only <rule>`, and `--write` per targeted fixes.
- **Codex CLI (`codex`)**: Required by `packages/agent/src/orchestrator/tool/codex/exec.ts`; confirm via `codex --version` (or `CODEX_BIN`) and ensure `CODEX_API_KEY` env exists (see `config/env.example`).
- **Playwright**: `bunx playwright install --with-deps chromium` installs browsers; tests configured via `apps/web/playwright.config.ts` with env knobs `PLAYWRIGHT_SKIP_WEB_SERVER`, `MINDSCAPE_PORT`, etc.
- **Preview cleanup worker**: `packages/agent/src/orchestrator/tool/worktree.ts` houses `flushPreviewCleanupBacklog`, invoked from `packages/api/src/init.ts`. Env vars: `WORKTREE_PREVIEW_CLEANUP_INTERVAL_MS`, `WORKTREE_PREVIEW_CLEANUP_ROOT`.
- **Metrics registry**: `packages/api/src/metrics.ts` exports Prometheus metrics consumed by the limiter. Tests rely on `packages/api/test/utils/mock-metrics.ts` to avoid global registry collisions.
- **Documentation**: `docs/reports/duplicate-issues-closure.md`, `docs/reports/linear-issues-fixes-2025-01-27.md`, `docs/reports/linear-issues-audit-2025-01-27.md`, and the new lint triage report are authoritative references; update them whenever states change.
