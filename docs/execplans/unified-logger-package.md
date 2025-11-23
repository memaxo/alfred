# Unified Logger Package Implementation Plan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md`

## Purpose / Big Picture

This plan implements a unified, dependency-free logging package (`@alfred/logger`) for the ALFRED monorepo. Currently, logging logic is duplicated across `api`, `runtime`, and `db` packages, with inconsistent behavior and some no-op implementations.

By consolidating logging into a single package, we ensure:
1.  **Consistent Output**: Structured JSON in production, pretty-printing in development.
2.  **Performance**: Minimal overhead using native `console` methods, suitable for hot paths.
3.  **Type Safety**: Shared `LogContext` and `LogLevel` types across the codebase.
4.  **Maintainability**: Single source of truth for log formatting and redaction rules.

After this change, developers will import `logger` from `@alfred/logger` instead of local utils, and all services will emit consistent logs.

## Progress

- [x] Create `packages/logger` workspace
- [x] Implement core logger logic
- [x] Add unit tests for logger
- [x] Migrate `@alfred/db`
- [x] Migrate `@alfred/metrics`
- [x] Migrate `@alfred/api`
- [x] Migrate `@alfred/runtime`
- [x] Migrate `@alfred/voice`
- [x] Verify system-wide logging

## Surprises & Discoveries

- `@alfred/metrics` had a stubbed logger that was exported. Retained re-export for backward compatibility but pointing to real logger.
- `@alfred/voice` defines its own `VoiceLogger` type. Used `@alfred/logger` as the default implementation.

## Decision Log

- Decision: Create `@alfred/logger` as a separate workspace.
  Rationale: Prevents circular dependencies and ensures clean separation of concerns.
  Date/Author: 2025-11-21 / Agent

## Outcomes & Retrospective

The logging system is now unified under `@alfred/logger`. This ensures consistent JSON logging in production across all services (`api`, `runtime`, `db`, `voice`) and developer-friendly pretty printing in development. Duplicated code has been removed.

- **Verified**: All core packages (`api`, `agent`, `runtime`, `db`, `voice`, `metrics`) now depend on `@alfred/logger`.
- **Removed**: Local `utils/logger.ts` files in `api`, `runtime`, `db` have been removed or are confirmed missing.
- **Metrics**: The `metrics` package re-exports `logger` for backward compatibility but points to the unified implementation.
- **Agent**: Updated `learning-worker.ts` and `linear.ts` to use the unified logger.

## Context and Orientation

Current State:
- `packages/api/src/utils/logger.ts`: Working implementation (JSON/Pretty).
- `packages/runtime/src/utils/logger.ts`: Duplicate of API logger.
- `packages/db/src/utils/logger.ts`: Broken/No-op implementation.
- `packages/metrics/src/logger.ts`: No-op implementation.
- `packages/voice`: Defines interface but no implementation.

The new package `@alfred/logger` will sit at the same level as `packages/type` or `packages/metrics`, serving as a foundational utility.

## Plan of Work

### Phase 1: Create Package
1.  Create `packages/logger/package.json` and `tsconfig.json`.
2.  Implement `src/index.ts` with the consolidated logic from `@alfred/api`.
3.  Add `src/logger.test.ts` to verify formatting and context merging.

### Phase 2: Implementation Details
The logger will:
- Support `debug`, `info`, `warn`, `error` levels.
- Accept a message string and optional `LogContext` object.
- Automatically inject `timestamp`, `service` (configurable), and `environment`.
- Use `console.log` (and friends) directly to avoid external dependencies.
- Support a `configure({ service: string })` method to set the service name per-package if needed, or default to a generic one.

### Phase 3: Migration
Iterate through each package:
1.  Add `@alfred/logger` dependency.
2.  Replace local imports with `@alfred/logger`.
3.  Delete local `utils/logger.ts` files.
4.  Fix any type mismatches.

## Concrete Steps

1.  **Scaffold Package**
    ```bash
    mkdir -p packages/logger/src
    # Create package.json, tsconfig.json
    ```

2.  **Implement Logger**
    ```typescript
    // packages/logger/src/index.ts
    export type LogLevel = "debug" | "info" | "warn" | "error";
    export interface LogContext { [key: string]: unknown; }
    // ... implementation ...
    ```

3.  **Test**
    ```bash
    cd packages/logger && bun test
    ```

4.  **Migrate DB**
    - Update `packages/db/package.json`
    - Update `packages/db/src/client.ts` (and others)
    - Delete `packages/db/src/utils/logger.ts`

5.  **Migrate API & Runtime**
    - Similar steps.

## Validation and Acceptance

1.  **Unit Tests**: `bun test` in `packages/logger` passes.
2.  **Type Check**: `bun run typecheck` passes across the monorepo.
3.  **Runtime Verification**:
    - Run `bun run dev`.
    - Observe logs from API/Runtime in console.
    - Verify dev format (readable) vs prod format (simulated via NODE_ENV=production).

## Idempotence and Recovery

- Safe to run multiple times.
- If migration fails, revert git changes.
- Old logger files can be restored if needed.

## Interfaces and Dependencies

**Dependencies**: None (dev-only: `bun-types`, `bun-test`).

**Interface**:
```typescript
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
```
