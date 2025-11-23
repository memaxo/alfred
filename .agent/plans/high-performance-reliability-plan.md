# High Performance & Reliability Upgrade Plan

This ExecPlan outlines the strategy to harden the system for high-performance environments, focusing on validation, resilience, and throughput.

Reference to PLANS.md: `.agent/PLANS.md` - this document must be maintained in accordance with the project's execution plan standards.

## Purpose
To ensure the system can handle high concurrency, recover from failures automatically, and provide robust validation of its actions in a production-grade environment.

## Goals
1.  **Robust Validation**: Implement "Level 4" verification scripts that exercise the system with real binaries and infrastructure.
2.  **Resilience**: Verify and improve crash recovery mechanisms (checkpointing/resume) under load.
3.  **Performance**: Optimize context gathering, plan execution, and database interactions for high throughput.
4.  **Observability**: Ensure metrics provide deep visibility into bottlenecks and failure modes.

## Progress

- [x] **Phase 1: Comprehensive Verification Suite**
  - [x] Implement `scripts/verify-orchestrator.ts` (Level 4 test).
  - [x] Create `scripts/verify-resilience.ts` to simulate crashes and verify resumption.
  - [x] Add `scripts/verify-all.ts` for single-command smoke testing.
- [x] **Phase 2: Resilience Hardening**
  - [x] Verify `PlanRunner` checkpointing with `verify-resilience.ts`.
  - [x] Implement "Dead Letter Queue" logic for plans that fail repeatedly after resume.
  - [x] Ensure `PipelineRunner` correctly handles rapid escalation/transition loops without stack overflow or infinite loops.
- [x] **Phase 3: Performance Optimization**
  - [x] **Context Caching**: Implement optimized in-memory caching (LRU) for `ContextBuilder` to handle high concurrency within a single instance.
  - [x] **Dependency Analysis**: Replace regex-based `analyzeDependencyGraph` with a proper AST parser (`oxc-parser` or similar) for speed and accuracy.
  - [x] **Database**: Verify `cognitive_events` and `cognitive_snapshots` indexes are sufficient for high-volume writes/reads. (Current: `streamId`, `createdAt`). Add compound indexes if needed for specific query patterns.
  - [x] Generate migration for new indexes
- [x] **Phase 4: Concurrency & Throttling**
  - [x] Make `maxParallel` in `runWaves` configurable via environment variable (`ORCHESTRATOR_MAX_PARALLEL`).
  - [x] Implement a global semaphore/rate-limiter for LLM calls to prevent rate limits in high-concurrency scenarios.

- [x] **Phase 5: Production Readiness**
  - [x] **Verification**: `scripts/verify-all.ts` passes locally (excluding timeout-prone Codex execution).
  - [x] **Security**: Verified `authz` token propagation from Runtime to Tools.
  - [x] **Observability**: Confirmed metrics and logging in core flows.

## Follow-up Plans

- **Level 5 Testing**: See `docs/execplans/level-5-testing-plan.md` for the strategy to unmock the execution environment and implement Domain-Driven Testing.

- Pending start.

## Decision Log

- Decision: Prioritize In-Memory LRU over Redis.
  Rationale: ALFRED is a single-user system (per `02-architecture.md`). Introducing Redis adds unnecessary infrastructure complexity. In-memory caching with process isolation is sufficient for performance goals.
  Date/Author: 2025-11-21 / Droid

## Outcomes & Retrospective

- Pending completion.

## Detailed Steps

### Phase 1: Verification Suite

1.  **Orchestrator Verification**:
    - Script: `scripts/verify-orchestrator.ts`
    - Spins up a full `WorkflowRuntime`.
    - Feeds a requirement: "Create a file named `proof.txt` with content `QED`".
    - Asserts file creation and content.
    - Asserts `cognitive_events` are written.

2.  **Resilience Verification**:
    - Script: `scripts/verify-resilience.ts`
    - Starts a plan.
    - Manually kills the process (or simulates termination) halfway.
    - Restarts the process (or calls `resumeInterruptedPlans`).
    - Asserts the plan completes successfully.

### Phase 2: Resilience Hardening

1.  **Dead Letter Queue**:
    - In `resumeInterruptedPlans`, check `retryCount` in snapshot or tracking table.
    - If retries > 3, mark as "failed_terminal" and alert.

### Phase 3: Performance

1.  **AST Parser**:
    - Benchmarking current regex vs `oxc-parser`.
    - If > 2x faster or significantly more accurate, switch.
    - **Budget**: Dependency analysis < 50ms per 100 files.

2.  **Context Caching**:
    - Abstract `ContextBuilder` cache to an interface.
    - Provide `MemoryCache` (default) and `RedisCache` (optional).
    - **Optimization**: Verified `ContextBuilder` caching with benchmarks (`packages/runtime/test/bench/context-cache.bench.ts`).

### Phase 4: Concurrency

1.  **Configurable Parallelism**:
    - Update `waves.ts` to read `process.env.ORCHESTRATOR_MAX_PARALLEL` (default: 2).

## Validation

- **Success Criteria**:
    - `verify-all.ts` passes in < 60s (excluding LLM latency).
    - Resilience test proves plan continuation after crash.
    - Metrics show no unhandled promise rejections or memory leaks during stress testing.
