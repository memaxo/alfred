# CI Gating & Merge Policy

## Objectives
- Keep `main` green by serialising high-impact merges while allowing safe fast lanes.
- Ensure documentation and test updates land quickly without waiting on full suites.
- Map PR labels to deterministic CI behaviour so reviewers understand required checks.

## Staged Merge Flow
- **Stage 0 – Local:** Developers run `bun run ruler:verify`, `bun run typecheck:workspace`, and targeted `bunx turbo test --filter=...` before opening a PR.
- **Stage 1 – Pull Request:** GitHub Actions enforce the correct lane based on labels and changed files. Required checks block merge until they pass.
- **Stage 2 – Merge Queue:** `main` adopts GitHub’s merge queue with `group: main` so only one high-impact merge lands at a time. Queue entries reuse the Stage 1 checks; doc/test fast lanes bypass the queue because they do not touch runtime code.

## CI Lanes

| Lane | Label | Eligible Changes | Required Checks | Notes |
| --- | --- | --- | --- | --- |
| `full` | `ci:full` (default when no fast-lane label) | Any change (including runtime, schema, config) | `ruler-verify`, `typecheck-workspace`, `turbo-test` | Required for pushes to `main`. Merge queue only accepts PRs that satisfied this lane. |
| `docs` | `ci:docs` | Markdown + diagrams under `docs/**`, repo docs (`README.md`, `.mdx`), and generated `.ruler/**` outputs | `ruler-verify` | Fails closed if non-doc files change. Skips merge queue. |
| `tests` | `ci:tests` | Files ending in `.test.ts`, `.spec.ts`, or located under `__tests__/` with zero runtime/Schema changes | `ruler-verify`, `turbo test --filter=changed`, optional `typecheck` if reviewer requests | Intended for refactor-free test authoring. Adding runtime code flips the lane back to `full`. |
| `db` | `ci:db` | Anything touching `packages/db/**` or `config/env.example` | `ruler-verify`, `typecheck-workspace`, `turbo test`, `bun run db:migrate -- --dry-run` | Forces merge queue serialization because schema changes can break running instances. |

### Lane Evaluation Rules
1. `ci:docs` or `ci:tests` labels are opt-in. Absence of a fast-lane label defaults to `ci:full`.
2. Fast lanes require matching path filters. If a non-matching file appears, the workflow removes the fast-lane label via the API and re-runs the full lane.
3. Only one fast-lane label may be active at a time. Applying `ci:db` always overrides other labels.

## Workflow Architecture

Create `.github/workflows/ci.yml` with the following structure:

1. **changes** job  
   - Uses `dorny/paths-filter@v3` to classify modified files into `docs`, `tests`, `db`, and `runtime`.  
   - Emits `docs_only`, `tests_only`, and `requires_db_lane` outputs.  
   - For PRs, writes the active lane to `${{ github.output }}` and posts a summary comment when a fast lane is eligible.
2. **ruler** job (required for all lanes)  
   - Reuses the existing Bun setup.  
   - Runs `bun run ruler:verify`.
3. **typecheck** job  
   - Executes when the active lane is `full` or `db`.  
   - Command: `bun run typecheck:workspace`.
4. **tests** job  
   - Default command: `bunx turbo test`.  
   - When the lane is `tests`, pass `--filter=$CHANGED_PACKAGES` so only affected workspaces execute. The filter is derived from the `changes` job outputs.
5. **migrate-dryrun** job  
   - Runs only for `ci:db` lane.  
   - Command: `bun run db:migrate -- --dry-run`.

Apply `concurrency: { group: main-${{ github.ref }}, cancel-in-progress: true }` to the workflow so re-pushes replace older runs. `migrate-dryrun` additionally sets `concurrency.group: db-migrations`.

## Label Policy
- Add repository labels: `ci:full`, `ci:docs`, `ci:tests`, `ci:db`.
- Require one CI label before merging. A `pull_request_target` workflow can auto-apply `ci:full` on open.
- Educate reviewers: if a PR clearly fits a fast lane but lacks the label, apply it to unblock parallel merges.

## Merge Protection Settings
- Enable GitHub merge queue on `main` with the required checks `ruler`, `typecheck`, `tests`, `migrate-dryrun`.
- Configure branch protection so pushes bypassing PRs are disallowed.
- Grant `docs` and `tests` lanes bypass permission by marking their checks as optional for the queue while keeping them required for the PR itself.

## Turbo Pipeline Updates
- Add a `ci` task alias in `package.json`: `"ci": "turbo run typecheck test"` for local parity.
- Ensure `turbo.json` lists `typecheck` and `test` tasks with explicit `inputs` and `outputs` so caching stays effective during merge queues.

## Follow-Up Tasks
1. Implement `.github/workflows/ci.yml` as described (the change is substantial enough to stage separately from this documentation).
2. Update `ruler-check.yml` to become a lightweight `docs` check or deprecate it once the new workflow lands.
3. Draft a short internal announcement pointing to this document and outlining the label expectations.
