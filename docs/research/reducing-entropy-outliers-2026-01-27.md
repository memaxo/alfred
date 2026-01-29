# reducing-entropy-outliers-2026-01-27

Purpose: identify the **largest entropy outliers** (by code volume) and the highest-leverage **deletion/consolidation** opportunities.

## Mindset loaded

Loaded: `.agents/skills/reducing-entropy/references/design-is-taking-apart.md`

Core principle: **Design is taking things apart** — reduce complexity by separating concerns and removing dependencies (delete/consolidate before adding).

## Measurement scope

- Repo root: `/Users/jackmazac/Development/alfred`
- Counted as “code”: `*.{ts,tsx,js,jsx}`
- For overall percentiles/totals: excluded `node_modules/`, `vendor/`, `.git/`, `.factory/`, `.agents/`, `.agent/`, `dist/`, `build/`, `coverage/`, `test-results/`, `tmp/`, `logs/`.

## Repo-wide size distribution (code files)

- Files counted: **3349**
- Total lines: **568,541**
- Line-count percentiles per file: **p50=112**, **p90=386**, **p95=530**, **p99=848**, **max=15,534**

Interpretation: anything above ~**850 LOC** is a p99 outlier.

## Extreme outliers (highest leverage)

### 1) Committed Python venv under `packages/voice/.venv/`

- `packages/voice/.venv/**` contains at least **17,741** lines of JS/TS across **9** files.
- Largest single file:
  - **15,534** LOC: `packages/voice/.venv/lib/python3.12/site-packages/tensorboard/plugins/projector/tf_projector_plugin/projector_binary.js`

Why it’s an entropy outlier: vendored env artifacts are pure bulk and churn; they’re not a source of truth.

High-leverage action (requires explicit deletion approval): delete `packages/voice/.venv/` and ensure it’s ignored.

### 2) Systematic duplicated sources: `packages/*/src/**` has both `.ts` and emitted `.js`

Detected **141** stems where both `X.ts` and `X.js` exist under `packages/*/src/**`.

Volume in these pairs:

- TS lines (paired): **34,599**
- JS lines (paired): **25,350**
- Combined duplicated surface: **59,949** lines

The `.js` looks like compiled output of the `.ts` (example: `packages/agent/src/orchestrator/tool/docker.ts` vs `docker.js`).

Top duplicate pairs by combined LOC:

| total |    ts |    js | stem                                                 |
| ----: | ----: | ----: | ---------------------------------------------------- |
| 3,846 | 2,063 | 1,783 | `packages/agent/src/orchestrator/tool/docker`        |
| 1,874 | 1,054 |   820 | `packages/agent/src/orchestrator/tool/opencode/exec` |
| 1,866 | 1,043 |   823 | `packages/agent/src/environment/agentfs`             |
| 1,610 |   937 |   673 | `packages/agent/src/orchestrator/tool/codex/exec`    |
| 1,587 |   981 |   606 | `packages/agent/src/orchestrator/tool/codex/server`  |

High-leverage action (requires explicit deletion approval): pick one canonical source-of-truth and delete the other.

- **Likely best (Bun-first): keep TS, delete emitted JS** in `packages/*/src/**` → immediate ~**25k LOC** reduction, plus less drift.
- Alternative: keep JS, delete TS (bigger LOC reduction ~**35k**), but likely breaks type-level ergonomics unless TS files are “real source”.

### 3) Large single-file p99 outliers (non-venv)

Top p99 files (excluding the committed venv JS file):

|   loc | path                                             |
| ----: | ------------------------------------------------ |
| 2,382 | `packages/api/src/routers/agentfs.ts`            |
| 2,063 | `packages/agent/src/orchestrator/tool/docker.ts` |
| 1,783 | `packages/agent/src/orchestrator/tool/docker.js` |
| 1,686 | `packages/api/test/review.router.test.ts`        |
| 1,537 | `packages/db/src/repo/review.ts`                 |
| 1,491 | `packages/db/src/schema/auth.d.ts`               |
| 1,446 | `packages/api/src/routers/review.ts`             |
| 1,431 | `packages/runtime/src/orchestrator/agent.ts`     |
| 1,377 | `apps/native/lib/voice/session.ts`               |
| 1,358 | `packages/codeprint/src/index.ts`                |

Notes:

- `apps/web/src/routeTree.gen.ts` (~1,096 LOC) is generated volume.
- `packages/db/src/schema/*.d.ts` is generated-ish volume; still adds surface area for changes/search.

## Biggest directories (total LOC)

Top “dir2” totals (first two path segments):

|     loc | files | path             |
| ------: | ----: | ---------------- |
| 133,793 |   873 | `apps/web`       |
|  89,182 |   412 | `packages/agent` |
|  79,654 |   379 | `packages/api`   |
|  44,754 |   303 | `apps/native`    |
|  29,491 |   165 | `packages/db`    |

Notable concentration:

- `packages/api/test` alone: **38,001** LOC (high, but tests are often “good bulk”).
- `packages/agent/src/orchestrator`: **42,190** LOC (largest deep sub-tree scanned).

## Recommended deletion/consolidation targets (ranked)

1. **Delete committed `packages/voice/.venv/`** (largest single-file outlier; likely accidental).
2. **Eliminate `.ts`+`.js` duplicate stems under `packages/\*/src/**`\*\* (systematic ~60k LOC duplicated surface).
3. **Stop committing generated artifacts where possible** (e.g. `apps/web/src/routeTree.gen.ts`, large `*.d.ts`) by generating in build/CI instead (smaller win, but reduces churn).
4. **Trim jumbo tests/routers** only if they contain repeated setup boilerplate; do it by deleting duplication (helpers that reduce net LOC), not by “refactor splitting”.

## If you want me to execute the reductions

Tell me which deletions you explicitly approve (at minimum: whether I may delete `packages/voice/.venv/` and whether the canonical source should be TS-only or JS-only under `packages/*/src/**`).
