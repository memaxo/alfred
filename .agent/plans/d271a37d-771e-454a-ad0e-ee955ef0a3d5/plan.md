# Graph Fallbacks and JS Artifact Sync

This ExecPlan is a living document. Maintain it per `.agent/PLANS.md` so another contributor can resume the effort without extra context.

## Purpose / Big Picture

These changes target ALFRED itself. We need SQLite graph traversal so local dev and CI can run without Postgres, an automated pipeline to sync `.ts` sources with the `.js` artifacts that the Codex toolchain imports, a Codex SDK stub so tests do not depend on the real `@openai/codex-sdk`, smarter entity-linking heuristics to skip unnecessary embeddings, broader emergent-behavior fixtures to keep personas current, and documentation describing how to regenerate the JS artifacts. After finishing, a developer running in SQLite-only mode can execute real graph traversals, CI/pre-commit will fail if `.js` artifacts drift, tests no longer warn about missing Codex metrics hooks, heuristics avoid needless embedding calls for obvious anchors, persona fixtures cover Politics/News/AI, and the README explains how and when to run the sync script.

## Progress

- [x] (2025-11-27T19:28:00Z) Add SQLite fallback logic for `findNearestConcept`, wire up BFS helpers, and land `graph.traverse.sqlite.test.ts` (passes under `DATABASE_URL=sqlite::memory:`).
- [x] (2025-11-27T19:40:00Z) Land `tools:sync-js` (sucrase-based) plus CI + pre-commit wiring, updated dependencies, and verified via `bun run tools:sync-js`.
- [x] (2025-11-27T20:05:00Z) Introduce Codex SDK stub loader, adapt `executeWithSdk` to await it, and verify via `bun test packages/agent/test/codex-*.test.ts`.
- [x] (2025-11-27T20:20:00Z) Enhance `linkEntities` heuristics/tests to short-circuit embeddings and extend emergent-behavior fixtures plus persona assertions for Politics/News/AI.
- [x] (2025-11-27T20:30:00Z) Document the JS artifact workflow in `packages/agent/README.md`, clarifying `bun run tools:sync-js` usage.

## Surprises & Discoveries

- Observation: `.agent/plans/*/` is ignored by `.gitignore`, so new ExecPlan directories must be force-added.
  Evidence: `git check-ignore -v .agent/plans/d271a37d-771e-454a-ad0e-ee955ef0a3d5/plan.md` pointed to the ignore rule until `git add -f` was used.

## Decision Log

- Decision: _Pending_.
  Rationale: _Pending_.
  Date/Author: _Pending_.
- Decision: Force-add the new ExecPlan under `.agent/plans/<runId>` while keeping the existing ignore rules intact.
  Rationale: `.agent/plans/*/` ignores nested folders, so `git add -f` is required to persist the mandated plan structure without broadening ignore scope.
  Date/Author: 2025-11-27 / Codex
- Decision: Load `@openai/codex-sdk` lazily with a stub fallback so missing SDKs no longer break imports or spam `metrics_agent_hooks_disabled`.
  Rationale: Tests and API metrics import `@alfred/agent` even when the SDK isn't installed; a cached loader with a minimal `Codex` shim keeps behavior deterministic without forcing the real dependency.
  Date/Author: 2025-11-27 / Codex

## Outcomes & Retrospective

- _Pending_. Capture what shipped, any gaps, and follow-up items.

## Context and Orientation

The work spans several packages:
- `packages/db/src/repo/graph/traverse.ts` currently issues Postgres recursive CTEs unconditionally. When `isSqliteDriver()` is true, `db.execute(sql`...`) fails, so sqlite runs stub out traversal logic. We must add a JS BFS path that uses Drizzle queries against `memory_nodes`/`memory_edges`.
- `packages/agent/src/**/*.ts` exports are consumed as `.js` by Codex runtimes (e.g., `packages/agent/src/orchestrator/tool/git.ts` imports `./approval.js`). The repo keeps hand-generated `.js` siblings that drift. No tooling ensures they match, and CI/pre-commit do not regenerate them.
- `packages/agent/src/orchestrator/tool/codex/exec.ts` imports classes from `@openai/codex-sdk` directly. When that package is missing or unavailable, simply importing `@alfred/agent` fails which trips `metrics_agent_hooks_disabled`. We need a safe loader that falls back to a stub implementation for tests.
- `packages/agent/src/services/entity-linker.ts` always calls `embedMany`, even when heuristics already indicate anchor matches (e.g., explicit references to React or “Politics”). This wastes latency.
- `packages/agent/test/emergent-behavior.test.ts` keeps a fixture map with only Coding/Security/AI coverage. Persona assertions only cover Coding/Security. We need fixtures/testing for Politics, News, and AI anchors so heuristics remain validated.
- `packages/agent/README.md` lacks instructions for regenerating `.js` artifacts, producing on-boarding churn.

## Plan of Work

1. **SQLite traversal fallback**
   - Extend `findNearestConcept` to branch on `isSqliteDriver()`. Add helper(s) in the same module to load nodes/edges via Drizzle, decode embeddings from SQLite blobs if present, and run a BFS that honors `maxDepth`, `resource`, and `targetConcepts`. Mirror the Postgres behavior of skipping the depth-0 match when it equals the start label. Add pure helper utilities (e.g., `decodeEmbeddingBlob`, `cosineSimilarity`) with unit coverage if feasible. Include targeted tests (sqlite mode) under `packages/db/test` or a new test file to ensure BFS works with simple graphs.

2. **JS artifact sync tooling**
   - Create `scripts/tools/sync-js.ts` (or similar) that enumerates `.ts` files with sibling `.js` files (within `packages/agent/src` and any other required roots), runs `sucrase` with the `typescript` transform, and overwrites the `.js` files deterministically. Cache metadata (e.g., using `Promise.all`). Add `sucrase` to the root devDependencies. Wire `package.json` scripts: `"tools:sync-js": "bun scripts/tools/sync-js.ts"`. Update `.husky/pre-commit` to run the sync before stashing/formatting and re-stage affected `.js` files. Update the `ci` script to run `bun run tools:sync-js` and fail if it produces diffs (`git diff --exit-code`).

3. **Codex SDK stub loader**
   - Add `packages/agent/src/orchestrator/tool/codex/sdk.ts` exporting `loadCodexSdk` that attempts to `import("@openai/codex-sdk")` and falls back to an in-repo stub (with simple `Codex`/`Thread` classes) when the import fails or when `process.env.CODEX_SDK_STUB === "1"`. Update `exec.ts` (and any other Codex-focused modules) to `await loadCodexSdk()` inside `createCodexClient`. Ensure the stub emits deterministic events so `executeWithSdk` stays functional, and log once when the stub activates. Generate `.js` siblings for the new module.

4. **Entity-linking heuristics and fixtures**
   - Introduce a heuristics map (keywords → anchor labels) inside `entity-linker.ts`, including anchors for Coding, Security, AI, Politics, and News. Before calling `embedMany`, partition candidates: those covered by heuristics skip embeddings; others share a single `embedMany` call. Handle partial embedding failures without double-counting metrics. Update `packages/agent/test/emergent-behavior.test.ts` to cover Politics/News/AI fixtures and assert that embeddings are skipped for obvious anchors (via mock expectations).

5. **Documentation**
   - Update `packages/agent/README.md` with a short “JS Artifacts” section describing why `.js` files exist, the new `bun run tools:sync-js` command, and when to run it (before committing, after editing `.ts` modules that export to Codex).

## Concrete Steps

1. Inspect `memory_nodes` / `memory_edges` data needs and implement helpers plus sqlite BFS inside `packages/db/src/repo/graph/traverse.ts`. Add targeted tests (e.g., `packages/db/test/graph.traverse.sqlite.test.ts`). Run `bun test packages/db/test/graph.traverse.sqlite.test.ts`.
2. Add `scripts/tools/sync-js.ts`, install `sucrase`, and update root `package.json` scripts + `ci`. Modify `.husky/pre-commit` to call the sync script and restage generated `.js`. Run `bun run tools:sync-js`, verify `git status` clean, and execute `git diff --stat` to confirm no stray changes.
3. Create Codex SDK stub loader and adjust `exec.ts` plus generate `.js`. Update existing tests if needed. Run `bun test packages/agent/test/codex-exec.test.ts packages/agent/test/codex-session.test.ts`.
4. Enhance `entity-linker.ts` heuristics + tests (`packages/agent/test/emergent-behavior.test.ts`). Run that test file directly.
5. Update `packages/agent/README.md`. Re-run `bun run tools:sync-js` to refresh `.js` outputs touched earlier, ensure no diffs remain.
6. Execute a representative subset of the CI suite (at minimum `bun test --filter @alfred/agent` or targeted files) plus `bun run tools:sync-js && git diff --exit-code` to simulate the new CI guard.

## Validation and Acceptance

- `bun test packages/db/test/graph.traverse.sqlite.test.ts` passes using the sqlite driver.
- `bun test packages/agent/test/codex-exec.test.ts packages/agent/test/codex-session.test.ts packages/agent/test/emergent-behavior.test.ts` all pass without requiring the real Codex SDK and without warnings about disabled metrics hooks.
- `bun run tools:sync-js` leaves the working tree clean when executed twice in a row.
- `bun run ci` (or at least the `tools:sync-js` + `git diff --exit-code` segment) succeeds locally, demonstrating the gating works.
- Documentation clearly states when to rerun the sync command.

## Idempotence and Recovery

- The sqlite BFS operates on readonly queries; re-running is safe.
- The sync script overwrites `.js` artifacts deterministically based on `.ts` content. Running it multiple times without `.ts` changes is a no-op (verified in validation).
- The Codex stub loader caches whichever module (real or stub) loads first; no global mutations occur beyond logging once.
- Heuristic changes only touch in-memory calculations; if the mapping needs adjustment, edit the map and rerun the same tests.
- Documentation updates contain no scripts or migrations, so they are reversible via git if needed.

## Artifacts and Notes

- Capture any key diffs or command transcripts here once available (e.g., sample output from the sqlite traversal test, sync script logs, etc.).

## Interfaces and Dependencies

- `packages/db/src/repo/graph/traverse.ts`
  - New helper: `async function findNearestConceptSqlite(args)` returning `{ concept, path, node } | null`.
  - Utility types: `type GraphContext = { nodes: Map<string, NodeRow>; adjacency: Map<string, Set<string>>; }`.
- `scripts/tools/sync-js.ts`
  - Export nothing; invoked via `bun`. Accept optional `--check` flag later if needed.
  - Uses `sucrase.transform(code, { transforms: ["typescript"] })`.
- `packages/agent/src/orchestrator/tool/codex/sdk.ts`
  - Export `async function loadCodexSdk(forceStub?: boolean): Promise<{ Codex: typeof Codex }>` plus `function createCodexStub()`.
  - Log `codex_sdk_stub_activated` when fallback engages.
- `packages/agent/src/services/entity-linker.ts`
  - Add `const ENTITY_HEURISTICS: Record<string, string>` mapping lowercase keywords to anchor labels.
  - New helper `function shouldSkipEmbedding(entity: string): boolean` returning true when heuristics map the entity to a domain.
- `packages/agent/test/emergent-behavior.test.ts`
  - Extend fixture map to include nodes for `Politics`, `News`, and additional `AI` anchors.
  - Add persona assertion tests for the new domains and verify `embedMany` call counts under heuristics.
- `packages/agent/README.md`
  - Add “JS Artifacts” section documenting `bun run tools:sync-js` usage and CI/pre-commit integration.
