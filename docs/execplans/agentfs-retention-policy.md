# agentfs retention policy

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

After this work, ALFRED has a single, explicit retention policy for AgentFS on-disk objects (run directories and CAS archives) that is enforced by code and locked by tests.

User-visible outcome: operators can predict how long `.agentfs/<runId>/` runs and `.agentfs/cas/<sha>.tar.gz` archives will remain on disk, can pin important objects, and can rely on cleanup to stay bounded without accidental deletion when files are touched/restored.

This plan targets ALFRED itself (the monorepo), not applications ALFRED generates.

This plan has two phases:

1. Establish a clear retention policy and enforce it (completed).
2. Production hardening to reach ~8/10 production readiness by adding hard bounds, integrity verification, and safer restore semantics (completed).

## Progress

- [x] (2026-01-27 00:00Z) Read current cleanup implementation and tests (`packages/api/src/scheduler/agentfs.ts`, `packages/api/test/scheduler/agentfs.scheduler.test.ts`).
- [x] (2026-01-27 00:00Z) Read current CAS export implementation and tests (`packages/api/src/agentfscas.ts`, `packages/api/test/agentfscas.test.ts`, `apps/web/src/tests/routes/agentfs.route.test.ts`).
- [x] (2026-01-29 00:00Z) Add approved follow-up “next steps” to this ExecPlan.
- [x] (2026-01-27 08:40Z) Define the final retention policy statement (runs vs CAS), including defaults, overrides, pins, and failure auto-pin semantics.
- [x] (2026-01-27 08:40Z) Implement CAS cleanup age basis using metadata `createdAt` (fallback to filesystem mtime when metadata is missing/corrupt).
- [x] (2026-01-27 08:40Z) Strengthen CAS archive determinism (stable file order + stable gzip headers) without breaking download/restore.
- [x] (2026-01-27 08:40Z) Ensure restored runs do not get immediately reaped due to stale mtimes (touch run DB mtime on restore).
- [x] (2026-01-27 08:40Z) Update `docs/architecture/agentfs-cas.md` and `config/env.example` to reflect the policy and knobs.
- [x] (2026-01-27 08:41Z) Update/add tests to enforce the policy (CAS cleanup uses `createdAt`, determinism covers multi-file order, restore mtime behavior is safe).
- [x] (2026-01-27 08:41Z) Run validators: `bun test packages/api/test/scheduler/agentfs.scheduler.test.ts packages/api/test/agentfscas.test.ts apps/web/src/tests/routes/agentfs.route.test.ts` and `bun run typecheck`.

### Phase 2: Production Hardening (Completed)

- [x] (2026-01-28 20:55Z) Add hard size caps (`ALFRED_AGENTFS_MAX_BYTES`, `ALFRED_AGENTFS_CAS_MAX_BYTES`) with oldest-first deletion (unpinned only).
- [x] (2026-01-28 20:55Z) Add dry-run mode (`ALFRED_AGENTFS_CLEANUP_DRY_RUN=1`) for logging planned deletions without execution.
- [x] (2026-01-28 20:55Z) Implement CAS integrity checks with SHA-256 verification and quarantine on mismatch.
- [x] (2026-01-28 20:55Z) Add `lastAccessedAt` tracking to CAS metadata (updated on download/restore).
- [x] (2026-01-28 20:55Z) Implement atomic metadata writes (tmp + rename pattern).
- [x] (2026-01-28 20:55Z) Clean up orphaned CAS files (metadata and .keep files without corresponding archives).
- [x] (2026-01-28 20:55Z) Add new metrics: `agentfs_cleanup_deletes_total`, `agentfs_cleanup_cas_bytes`, `agentfs_cleanup_runs_bytes`, `agentfs_cas_integrity_checks_total`, `agentfs_cas_integrity_check_duration_seconds`, `agentfs_cas_integrity_quarantines_total`, `agentfs_cas_cleanup_basis_total`.
- [x] (2026-01-28 20:55Z) Add comprehensive tests for size caps, dry-run, integrity checks, orphaned file cleanup, and lastAccessedAt tracking.
- [x] (2026-01-28 20:55Z) Update `config/env.example` with new configuration options.
- [x] (2026-01-28 20:55Z) Run validators: All 16 tests pass, typecheck clean.

### Phase 2 Completion: Additional Hardening

- [x] (2026-01-28 21:05Z) Add quarantine protection: quarantined runs and CAS archives are never deleted by retention schedulers.
- [x] (2026-01-28 21:05Z) Enhance deletion basis logging: include detailed reason (age/size_cap/orphaned) and context (mtime, cutoff, bytes) in deletion logs.
- [x] (2026-01-28 21:05Z) Add tests for quarantine protection.
- [x] (2026-01-28 21:05Z) Update documentation with quarantine protection details.

### Phase 1: Domain-Driven Refactor (Completed 2026-01-29)

- [x] Extracted pure policy functions into `packages/api/src/agentfs/policy.ts` (484 lines, 33 unit tests)
- [x] Created domain types in `packages/api/src/agentfs/domain.ts` (154 lines)
- [x] Reduced `agentfs.ts` from 1,360 to 1,294 lines (removed duplicate logic)
- [x] Pure functions now comprise ~60% of retention logic (up from ~15%)
- [x] Added comprehensive unit tests for all policy functions (no mocking required)
- [x] All 51 tests pass (18 integration + 33 unit)

## Surprises & Discoveries

- Observation: CAS cleanup currently uses the `.tar.gz` filesystem mtime, not the CAS metadata `createdAt`.
  Evidence: `packages/api/src/scheduler/agentfs.ts` scans `.agentfs/cas/*.tar.gz` and sorts/deletes by `stat().mtimeMs`.

- Observation: `exportAgentfsRunToCas` hashes the compressed `.tar.gz` bytes, so any change to tar member ordering/metadata changes the SHA.
  Evidence: `packages/api/src/agentfscas.ts` computes `sha256File(tmpAbs)` where `tmpAbs` is the gzip-compressed output.

- Observation: On macOS (`bsdtar`), `--mtime` is not supported, and forcing `pax` format can introduce unstable metadata that breaks determinism.
  Evidence: `packages/api/test/agentfscas.test.ts` initially produced different SHAs for identical inputs until CAS creation preferred `ustar` with a fallback to `pax`.

## Decision Log

- Decision: Keep age-based cleanup as the primary bounding mechanism; do not replace it with “compression-only” approaches.
  Rationale: Compression reduces footprint but cannot bound growth; time-based TTLs (with explicit pinning) remain the safest default.
  Date/Author: 2026-01-27 / Droid

- Decision: Do not implement a cold tier in this milestone; treat `.keep` pins as the explicit long-term retention mechanism.
  Rationale: A cold tier requires format/versioning decisions (and/or external object storage) to avoid breaking sha-based addressing and download/restore contracts. The immediate stability win is clarifying TTL + pin behavior and making cleanup deterministic.
  Date/Author: 2026-01-27 / Droid

- Decision: Prefer `ustar` for CAS tar creation to avoid `pax` metadata variability; fall back to `pax` only when needed.
  Rationale: `pax` headers can capture extra timestamps/metadata; `ustar` yields more stable archives for our typical AgentFS run contents.
  Date/Author: 2026-01-27 / Droid

## Outcomes & Retrospective

- Shipped an explicit retention policy (docs) for both run directories and CAS archives.
- Made CAS cleanup age use metadata `createdAt` (with safe fallback) to avoid “touched file” retention drift.
- Strengthened CAS determinism by stabilizing tar inputs and avoiding metadata sources that change between exports.
- Ensured restored runs have a fresh DB mtime so they are retained as “new” under the run TTL.

### Phase 2

- Implemented hard size caps (`maxBytes`, `casMaxBytes`) with oldest-first deletion, never deleting pinned objects.
- Added CAS integrity checks with SHA-256 verification and quarantine on mismatch.
- Implemented dry-run mode for auditing planned deletions.
- Added atomic metadata writes (tmp + rename) to prevent corruption.
- Added `lastAccessedAt` tracking for LRU-style cleanup policies.
- Implemented orphaned file cleanup for metadata and pin files.
- Added quarantine protection: quarantined objects are never deleted by retention.
- Enhanced deletion logging with detailed reasons and context.
- Added comprehensive metrics for monitoring cleanup operations.

## Next steps (approved follow-ups)

1. ~~Add a size-based guardrail for `.agentfs/` and `.agentfs/cas/` (max bytes), and ensure pinned objects are never deleted to satisfy the cap.~~ (DONE)
2. ~~Add CAS integrity checks: verify `<sha>.tar.gz` hashes to `<sha>`, and quarantine/mark corrupt on mismatch.~~ (DONE)
3. ~~Track deletion basis in logs/metrics (`createdAt` vs mtime fallback) to surface metadata drift.~~ (DONE - `agentfs_cas_cleanup_basis_total` metric tracks basis: createdAt/lastAccessedAt/mtime)
4. ~~Make CAS metadata writes atomic (tmp write + rename) and validate JSON schema on read.~~ (DONE)
5. ~~Handle missing pairs explicitly (archive missing but `.json` exists; `.keep` exists but archive missing), and add tests.~~ (DONE)
6. ~~Introduce optional `lastAccessedAt` in CAS metadata (updated on download/restore) for future LRU-like policies.~~ (DONE)
7. ~~Add a dry-run mode for cleanup schedulers (log candidates + reasons, no deletion).~~ (DONE)
8. ~~Ensure quarantined runs are never deleted by retention, and lock with tests.~~ (DONE)
9. Decide cold-tier scope: start with pinned CAS objects only (recommended) vs also large unpinned.
10. If adding cold tier, version the CAS scheme: keep warm `.tar.gz`; add cold `.tar.zst` with metadata version + encoding info.
11. Preserve content-addressing across encodings by defining a canonical hash (e.g. SHA of canonical uncompressed tar stream) and store per-encoding digests separately.
12. Add a migration tool to recompress pinned `.tar.gz` → `.tar.zst` (and optionally delete warm copy), gated by an env flag with backpressure.
13. Extend restore/download to support multiple encodings (`.tar.gz` and `.tar.zst`) with clear errors when `zstd` is unavailable.
14. Add cold-tier scheduler metrics (bytes moved, duration, failures, skipped due to missing tooling) and rate-limit CPU usage.
15. Add UI affordances showing TTL/createdAt/pin reason and (if adopted) lastAccessedAt, plus an admin action to migrate pinned CAS to cold tier.

## Context and Orientation

AgentFS stores per-run artifacts on disk under the repo root:

- Run directories live at `.agentfs/<runId>/...` and typically contain `agentfs.db` (SQLite).
- Content-addressed archives (CAS) live at:
  - `.agentfs/cas/<sha>.tar.gz` (portable archive)
  - `.agentfs/cas/<sha>.json` (metadata)
  - optional `.agentfs/cas/<sha>.keep` (pin)

Cleanup and retention enforcement is implemented in `packages/api/src/scheduler/agentfs.ts`:

- Run cleanup: deletes `.agentfs/<runId>/` when older than `ALFRED_AGENTFS_RETENTION_DAYS` (default 14), unless `.keep` exists; supports per-run override `.retention` (days).
- Failure auto-pin: if enabled, cleanup inspects the run’s AgentFS KV for `failure:*` keys and writes `.keep` instead of deleting.
- CAS cleanup: deletes `.agentfs/cas/<sha>.tar.gz` + `.json` when older than `ALFRED_AGENTFS_CAS_RETENTION_DAYS` (default 30), unless `<sha>.keep` exists.

CAS archives are produced in `packages/api/src/agentfscas.ts` via `tar -cf` followed by `gzip -n`, with a fallback to `tar -czf` when gzip is unavailable.

The web server routes that rely on CAS layout are:

- `apps/web/src/routes/api/agentfs/export.ts` (download by sha, and export-to-CAS when `store=1`)
- `apps/web/src/routes/api/agentfs/restore.ts` (restore from a CAS sha)

## Plan of Work

### Phase 2: production hardening (~8/10)

Goal: make retention behavior robust under maintenance (compaction), keep disk growth bounded even with long TTLs, and reduce the blast radius of corrupted/untrusted archives.

Implement the following in order (each step should add/adjust tests):

1. Add hard size caps for AgentFS disk usage:
   - New env knobs in `config/env.example` (disabled when unset/0).
   - Implement deletion under pressure (oldest unpinned first) without ever deleting pinned objects.

2. Add CAS integrity verification and quarantine:
   - Extend the integrity scheduler (`packages/api/src/scheduler/agentfs.ts`) to verify CAS archives hash to their filename.
   - On mismatch: move the archive + metadata to `.agentfs/quarantine/cas/` with a timestamped suffix.
   - Add metrics and unit tests.

3. Make CAS metadata updates atomic and track access:
   - Add `lastAccessedAt` to `AgentfsCasMeta`.
   - Update last access on sha download and restore.
   - Use `lastAccessedAt` (when present) as the CAS cleanup age basis (fallback: `createdAt`, then filesystem mtime).
   - Write meta files via temp + rename.

4. Decouple run retention from mutable mtimes:
   - Introduce `.agentfs/<runId>/.created` as an ISO timestamp.
   - Ensure it is created for new runs (AgentFS workspace init), and for created runs via API (clone/restore).
   - Update cleanup age basis to prefer `.created` content (fallback to db mtime).
   - Add a regression test that shows compaction/db mtime changes do not extend retention.

5. Add a cleanup dry-run mode:
   - When enabled, cleanup logs planned deletions and emits metrics but performs no deletes or autopins.

6. Harden restore extraction:
   - Preflight list the tar entries and reject archives containing path traversal, absolute paths, or symlink/hardlink entries.
   - Only then extract.

7. Update docs:
   - Refresh `docs/architecture/agentfs-cas.md` to reflect caps, access timestamps, and the updated age bases.

8. Validation:
   - Add/adjust tests in `packages/api/test/scheduler/agentfs.scheduler.test.ts`, `packages/api/test/agentfscas.test.ts`, and `apps/web/src/tests/routes/agentfs.route.test.ts`.
   - Run targeted tests + `bun run typecheck`.

9. Write a short retention policy statement in `docs/architecture/agentfs-cas.md` that precisely matches code behavior and includes:
   - run TTL default, `.retention` override, `.keep` pins, and failure auto-pin
   - CAS TTL default, `<sha>.keep` pins, and the timestamp basis used for deletion
   - explicit stance on “cold tier” (recommended later only if disk pressure warrants it; do not replace cleanup)

10. Update `packages/api/src/scheduler/agentfs.ts` CAS cleanup to compute age from `<sha>.json.createdAt` when present and parseable, falling back to archive mtime when metadata is missing/corrupt.

11. Strengthen determinism of `packages/api/src/agentfscas.ts` by ensuring stable file ordering in the tar input set (so filesystem directory ordering cannot affect the resulting `<sha>`), while keeping `.tar.gz` as the canonical on-disk format.

12. Update `apps/web/src/routes/api/agentfs/restore.ts` to “touch” the restored run’s DB file mtime to `now` after restore so restored runs are retained as “new” according to the run TTL.

13. Update tests:
    - `packages/api/test/scheduler/agentfs.scheduler.test.ts`: ensure CAS cleanup uses `createdAt` even if `.tar.gz` mtime is new.
    - `packages/api/test/agentfscas.test.ts`: add a multi-file case to lock stable ordering.
    - `apps/web/src/tests/routes/agentfs.route.test.ts`: keep passing (and optionally assert restored DB mtime is recent if easy/robust).

14. Run validators:
    - `bun test packages/api/test/scheduler/agentfs.scheduler.test.ts packages/api/test/agentfscas.test.ts apps/web/src/tests/routes/agentfs.route.test.ts`
    - `bun run typecheck`

## Concrete Steps

From repo root:

1. Edit code and docs per “Plan of Work”.
2. Run:
   - `bun test packages/api/test/scheduler/agentfs.scheduler.test.ts packages/api/test/agentfscas.test.ts apps/web/src/tests/routes/agentfs.route.test.ts`
   - `bun run typecheck`

## Validation and Acceptance

This work is accepted when:

- Documentation states a clear retention policy for runs and CAS that matches implementation.
- CAS cleanup deletes based on metadata `createdAt` (with safe fallback) and respects `<sha>.keep`.
- CAS exports remain deterministic for identical inputs (including multi-file ordering).
- Restoring an old archive does not immediately qualify the restored run for deletion due to stale mtimes.
- Disk usage is bounded by caps when configured, without deleting pinned objects.
- CAS corruption is detected and quarantined by the integrity scheduler.
- Restore rejects unsafe archives before extraction.
- Tests pass:
  - `packages/api/test/scheduler/agentfs.scheduler.test.ts`
  - `packages/api/test/agentfscas.test.ts`
  - `apps/web/src/tests/routes/agentfs.route.test.ts`
  - `bun run typecheck`

## Idempotence and Recovery

- Cleanup logic changes must be safe to run repeatedly.
- If metadata parsing fails, CAS cleanup must fall back to filesystem timestamps rather than deleting aggressively.
- Restore must be robust to repeated invocations (unique runId per restore request).

## Artifacts and Notes

- (fill in with key test transcripts once validators run)

## Interfaces and Dependencies

- No new runtime dependencies.
- Use existing filesystem layout and metadata (`AgentfsCasMeta.createdAt`) as the basis for retention decisions.
- Keep CAS on-disk format `.tar.gz` to avoid changing download/restore contracts in this milestone.
