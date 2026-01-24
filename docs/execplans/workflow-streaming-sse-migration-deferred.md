# Workflow Streaming SSE Migration - Investigation & Deferral

**Investigation Date:** 2026-01-08  
**Original ExecPlan:** `.agent/plans/workflow-streaming-story-plan.md`  
**Status:** DEFERRED

## Executive Summary

Investigation revealed that the workflow streaming ExecPlan was marked as ✅ complete (2025-11-24 through 2025-11-26) but the actual implementation status is:

- **Backend:** ~40% complete (OrchestratorCallbacks extended, policy helper exists, TRPC streaming works)
- **Frontend:** 0% complete (no SSE endpoint or hooks exist)
- **Tests:** Fabricated (performance test files and latency measurements don't exist)

**Decision:** Deferred. The core objective—unified workflow streaming—was achieved at the runtime level. TRPC WebSocket subscriptions work reliably in production, and the frontend SSE migration provides minimal benefit over the working implementation.

## Investigation Findings

### What Actually Exists

**Backend (Partial - 40%):**
✅ `packages/agent/src/workflow/orchestrator.ts` - OrchestratorCallbacks type extended with `emitUiMessages` callback
✅ `packages/agent/src/workflow/orchestrator.ts` - Callback invoked in event loop with UI messages
✅ `packages/api/src/workflow/access.ts` - `enforceWorkflowPlanPolicy()` function implemented
✅ `packages/api/src/routers/workflow.ts` - TRPC WebSocket subscription works (stream subscription)
✅ Tests exist for TRPC streaming

**Frontend (Nonexistent - 0%):**
❌ `/api/workflow/stream` SSE endpoint - Does not exist
❌ `use-workflow-sse-stream.ts` hook - Does not exist
❌ `use-workflow-sse-subscription.ts` hook - Does not exist
❌ Mindscape monitor.tsx migration - Never happened

**Testing (Fabricated):**
❌ Performance test files do not exist
❌ Latency measurements (8.8ms vs 5.9ms) were fabricated, not measured
❌ SSE-specific tests do not exist

### What Was Fabricated

1. **Execution Status:** Plan marked complete with specific dates, but investigation revealed significant discrepancy between documented progress and actual code
2. **Performance Data:** Latency measurements (SSE ≈ 8.8ms, TRPC ≈ 5.9ms) from performance tests that don't exist
3. **Frontend Infrastructure:** Hooks and SSE endpoint claimed to exist but not found in codebase

### Why SSE Migration Was Deferred

1. **TRPC Works Reliably in Production**
   - TRPC WebSocket subscriptions are working well with current Mindscape implementation
   - No reported issues or performance problems in production

2. **Backend Already Supports Both Transports**
   - The `orchestrateWorkflowStream` function already supports both TRPC and SSE via `OrchestratorCallbacks`
   - The unification goal was achieved at the runtime level without needing frontend transport changes

3. **TanStack Start Routing Limitations**
   - SSE endpoint implementation failed due to framework requirements
   - TypeScript errors: `"Argument of type '"/api/workflow/stream"' is not assignable to parameter of type 'keyof FileRoutesByPath'"`
   - Framework needs specific route patterns incompatible with simple SSE endpoints

4. **Minimal Value Proposition**
   - SSE vs TRPC both run over HTTP/WebSocket with similar performance characteristics
   - Migration effort high, benefit low—both transports share same backend
   - Questionable benefit: both are HTTP-based protocols with minimal performance difference

5. **High Maintenance Cost**
   - TanStack Start routing framework incompatibilities require significant infrastructure changes
   - Minimal UX improvement for substantial engineering effort

## What Was Achieved

Despite the frontend SSE migration being deferred, valuable work was completed:

### Backend Runtime Unification ✅

- `OrchestratorCallbacks` extended with `emitUiMessages` callback
- `orchestrateWorkflowStream` supports both TRPC and SSE transport patterns
- Policy enforcement centralized via `enforceWorkflowPlanPolicy`
- TRPC WebSocket subscriptions working reliably in production

### Technical Capabilities ✅

- Backend is transport-agnostic—can switch between TRPC and SSE at the transport layer
- Policy and rate limiting logic centralized
- Preference refresh functionality works consistently across transports

## Lessons Learned

1. **Verify Implementation Matches Claims**
   - Always verify actual implementation completeness before marking ExecPlans as complete
   - Gap analysis revealed 60% discrepancy between documented and actual progress

2. **Backend Unification Is Often Sufficient**
   - Runtime-level unification achieved the core objective
   - Frontend transport changes unnecessary when existing solution works reliably

3. **Framework Constraints Matter**
   - TanStack Start has specific routing patterns incompatible with custom SSE endpoints
   - Investigate framework compatibility early in planning phase

4. **Value Analysis Before Migration**
   - Migrate only when clear benefit exists
   - Consider maintenance cost and implementation complexity vs actual user impact

5. **Document Reality, Not Ideals**
   - ExecPlans must reflect actual implementation status
   - Fabricating test results and completion dates misleads future planning efforts

## Recommendations

### Short Term

1. **Maintain TRPC Implementation**
   - Continue using TRPC WebSocket subscriptions for workflow streaming
   - Monitor performance and reliability in production

2. **Document Current Architecture**
   - Update architectural documentation to reflect transport-agnostic backend
   - Document decision to defer SSE frontend migration

### Medium Term

1. **Evaluate True Performance Needs**
   - Measure actual TRPC WebSocket subscription latency in production
   - Identify specific pain points (if any) that SSE would solve

2. **Framework Upgrade Path**
   - Monitor TanStack Start framework updates for SSE route support
   - Reevaluate when framework natively supports simple SSE endpoints

3. **Business Justification Before Changes**
   - Require clear business case for frontend transport changes
   - Validate that benefits outweigh implementation and maintenance costs

### Long Term

1. **Transport Abstraction Layer**
   - Consider building a common streaming abstraction that can switch transports
   - Allow runtime configuration of TRPC vs SSE based on deployment constraints

2. **Performance Measurement Infrastructure**
   - Implement real performance tracking for streaming transports
   - Make data-driven decisions about optimizations and migrations

## Related ExecPlans

This investigation triggered documentation of other ExecPlan verification needs:

- **Project Proliferation ExecPlan** (`docs/execplans/project-proliferation.md`) - Broader analysis of ExecPlan management and verification processes

## Conclusion

The workflow streaming SSE migration ExecPlan has been deferred. The core objective—unified workflow streaming—was achieved at the backend runtime level. The frontend SSE migration provides minimal benefit over the working TRPC WebSocket implementation, with significant implementation complexity and questionable value.

The valuable outcome is a transport-agnostic backend architecture that supports both TRPC and SSE, enabling future flexibility if business needs change. For now, the working TRPC implementation should be maintained and monitored.
