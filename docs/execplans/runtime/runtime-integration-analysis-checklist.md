# Files to Analyze for Phase 3 Runtime Integration ExecPlan

This document lists all files that need to be analyzed to answer the 20 penetrating questions before writing the ExecPlan for Phase 3: Runtime Integration Layer.

## Architecture & Boundaries (Questions 1-4)

### Package Structure & Dependencies
- `package.json` (root) - Monorepo workspace configuration
- `turbo.json` - Build pipeline and dependencies
- `tsconfig.base.json` - TypeScript path aliases and references
- `packages/*/package.json` - Individual package dependencies
  - `packages/cognitive/package.json`
  - `packages/knowledge/package.json`
  - `packages/learning/package.json`
  - `packages/policy/package.json`
  - `packages/agent/package.json`
  - `packages/api/package.json`
  - `packages/db/package.json`
  - `packages/rag/package.json`
- `docs/architecture/packages.md` - Package dependency graph documentation
- `docs/architecture/overview.md` - Architecture overview
- `.ruler/02-architecture.md` - Architecture rules

### Workflow Lifecycle & State Management
- `packages/api/src/routers/workflow.ts` - Workflow router (start, stream, resume)
- `packages/api/src/workflow/runner.ts` - Current runner implementation
- `packages/api/src/run-registry.ts` - Run registry for suspend/resume
- `packages/db/src/schema/workflow.ts` - Workflow database schema
- `packages/db/src/repo/workflow.ts` - Workflow repository functions
- `packages/type/src/workflow.ts` - Workflow type definitions
- `packages/type/src/runtime-context.ts` - RuntimeContext type

### Event Stream Patterns
- `packages/api/src/routers/workflow.ts` (lines 227-486) - tRPC subscription pattern
- `packages/api/src/workflow/runner.ts` (lines 194-535) - Event generator pattern
- `packages/type/src/stream.ts` - WorkflowEvent type definitions
- `packages/api/src/ai/normalize.ts` - Event normalization utilities
- `packages/api/src/utils/event-id.ts` - Event ID generation

## Integration Patterns (Questions 5-8)

### Context Building
- `packages/agent/src/orchestrator/flow/context.ts` - Current context building logic
- `packages/api/src/routers/assistant.ts` - Assistant context usage
- `packages/api/src/routers/orchestrator.ts` - Orchestrator context usage
- `packages/db/src/repo/rag.ts` - RAG repository (hybrid search)
- `packages/rag/src/doc.ts` - RAG ingest/retrieve functions
- `packages/knowledge/src/query.ts` - Knowledge graph queries
- `packages/knowledge/src/hypergraph.ts` - Hypergraph implementation

### Tool Registry & Execution
- `packages/agent/src/v6.ts` - Tool registry (`buildTools`, `buildAssistantTools`)
- `packages/agent/src/index.ts` - Agent package exports
- `packages/agent/src/orchestrator/tool/*.ts` - All orchestrator tools
  - `packages/agent/src/orchestrator/tool/codex.ts`
  - `packages/agent/src/orchestrator/tool/docker.ts`
  - `packages/agent/src/orchestrator/tool/droid.ts`
  - `packages/agent/src/orchestrator/tool/git.ts`
  - `packages/agent/src/orchestrator/tool/proxmox.ts`
  - `packages/agent/src/orchestrator/tool/router.ts`
  - `packages/agent/src/orchestrator/tool/ticket.ts`
  - `packages/agent/src/orchestrator/tool/web.ts`
- `packages/agent/assistant/src/tool/*.ts` - All assistant tools

### Domain Package APIs
- `packages/cognitive/src/index.ts` - Cognitive package exports
- `packages/cognitive/src/state.ts` - State machine definitions
- `packages/cognitive/src/flows.ts` - Flow implementations
- `packages/knowledge/src/index.ts` - Knowledge package exports
- `packages/knowledge/src/query.ts` - Query interface
- `packages/learning/src/index.ts` - Learning package exports
- `packages/learning/src/supervise.ts` - Learning functions
- `packages/policy/src/pdp.ts` - Policy Decision Point
- `packages/policy/src/decide.ts` - Policy evaluation

## AI SDK Integration (Questions 9-12)

### Current AI SDK Usage
- `packages/api/src/routers/assistant.ts` - `generateText` usage
- `packages/api/src/routers/orchestrator.ts` - `generateText` usage
- `packages/api/src/routers/workflow.ts` - Current workflow streaming
- `packages/api/src/ai/generate.ts` - AI SDK wrapper utilities
- `packages/api/src/stream/stream-handler.ts` - SSE streaming handler
- `apps/web/src/routes/api/assistant/$.ts` - Assistant SSE endpoint
- `apps/web/src/routes/api/orchestrator/$.ts` - Orchestrator SSE endpoint

### Event Normalization
- `packages/api/src/ai/normalize.ts` - `eventToUiMessages` function
- `packages/type/src/stream.ts` - UIMessage and WorkflowEvent types
- `packages/type/src/stream.zod.ts` - Zod schemas for validation
- `.ruler/15-ai-sdk-v6.md` - AI SDK v6 standards

### Tool Execution Patterns
- `packages/agent/src/orchestrator/tool/codex.ts` - Example tool implementation
- `packages/api/src/utils/error.ts` - Error handling utilities
- `packages/api/src/utils/redaction.ts` - PII redaction for events

## Performance & Scalability (Questions 13-16)

### Context Caching
- `packages/agent/src/orchestrator/flow/context.ts` (lines 36-58) - Context cache implementation
- `packages/db/src/repo/rag.ts` - RAG caching patterns
- `packages/rag/src/doc.ts` - Embedding caching

### Concurrency & Resource Management
- `packages/api/src/run-registry.ts` - Run registry for concurrent workflows
- `packages/api/src/workflow/runner.ts` - Cancellation and timeout handling
- `packages/db/src/client.ts` - Database connection pooling

### Database Transactions
- `packages/db/src/repo/workflow.ts` - Transaction usage examples
- `packages/db/src/repo/rag.ts` - Transaction patterns
- `.ruler/04-database.md` - Database rules (transactions, batch operations)

### Token & Memory Management
- `packages/agent/src/orchestrator/flow/context.ts` (lines 534-668) - Token estimation
- `packages/agent/src/util/token.ts` - Token counting utilities
- `packages/api/src/workflow/runner.ts` (lines 47-55) - Context maxTokens config

## Migration & Compatibility (Questions 17-19)

### Current Runner Implementation
- `packages/api/src/workflow/runner.ts` - Complete current implementation
- `packages/api/src/routers/workflow.ts` - Router integration with runner
- `packages/type/src/workflow.ts` - Workflow type definitions
- `.agent/plans/orchestrator-implementation-plan.md` - Previous implementation plans

### Resume & Suspend Patterns
- `packages/api/src/routers/workflow.ts` (lines 540-676) - Resume endpoint
- `packages/api/src/workflow/runner.ts` (lines 68-79, 541-548) - Resume handling
- `packages/api/src/run-registry.ts` - Run registry for resume
- `packages/auth/src/token.ts` - Token verification for resume

### Event Consumers
- `apps/web/src/routes/orchestrator/run.tsx` - UI workflow viewer
- `apps/web/src/components/chat-container.tsx` - Chat UI
- `packages/api/src/routers/workflow.ts` (lines 358-405) - Event persistence
- `packages/agent/src/orchestrator/linear.ts` - Linear activity emission

## Testing & Observability (Question 20)

### Existing Tests
- `packages/api/test/workflow.runner.linear.test.ts` - Runner integration tests
- `packages/api/test/workflow.*.test.ts` - All workflow tests
- `packages/agent/test/*.test.ts` - Agent tool tests
- `packages/db/test/*.test.ts` - Database repository tests
- `packages/cognitive/test/*.test.ts` - Cognitive state tests

### Mocking Patterns
- `packages/api/test/utils/mock-metrics.ts` - Metrics mocking
- `packages/api/test/utils/db.ts` - Database test utilities
- `.ruler/05-testing.md` - Testing standards

### Observability
- `packages/api/src/metrics.ts` - Prometheus metrics
- `packages/api/src/utils/logger.ts` - Structured logging
- `packages/metrics/src/logger.ts` - Logger implementation
- `.ruler/18-observability.md` - Observability standards

## Additional Reference Files

### Documentation
- `docs/alfred-prd.md` - Product Requirements Document and priority development goals
- `docs/architecture/decisions.md` - Architecture Decision Records
- `docs/execplans/linear-integration.md` - Linear integration plan and outcomes
- `.ruler/17-workflow-patterns.md` - Workflow patterns
- `.ruler/09-purity-and-performance.md` - Performance budgets

### Existing Plans
- `.agent/plans/orchestrator-implementation-plan.md` - Previous orchestrator plan
- `.agent/plans/orchestrator-parity-plan.md` - Parity plan
- `docs/execplans/linear-integration.md` - Completed Linear integration plan

### Type Definitions
- `packages/type/src/*.ts` - All type definitions
  - `workflow.ts` - Workflow types
  - `stream.ts` - Stream event types
  - `runtime-context.ts` - Runtime context types
  - `cognitive.ts` - Cognitive state types
  - `knowledge.ts` - Knowledge graph types

## Analysis Checklist

### Phase 1: Architecture Understanding
- [ ] Read package.json files to understand dependencies
- [ ] Map dependency graph (no circular dependencies)
- [ ] Understand current workflow lifecycle (create → stream → resume → cancel)
- [ ] Identify event stream patterns (AsyncGenerator vs callbacks)

### Phase 2: Integration Patterns
- [ ] Analyze current context building (`packages/agent/src/orchestrator/flow/context.ts`)
- [ ] Understand tool registry structure (`packages/agent/src/v6.ts`)
- [ ] Review domain package APIs (cognitive, knowledge, learning, policy)
- [ ] Identify integration points for each domain package

### Phase 3: AI SDK Integration
- [ ] Review current `generateText` usage in assistant/orchestrator routers
- [ ] Understand `streamText` API from AI SDK v6 docs
- [ ] Map AI SDK events to WorkflowEvent types
- [ ] Identify tool execution patterns

### Phase 4: Performance & Migration
- [ ] Review context caching implementation
- [ ] Understand concurrency patterns (run registry)
- [ ] Review database transaction patterns
- [ ] Plan migration from `runPlanV6` to `WorkflowRuntime`

### Phase 5: Testing Strategy
- [ ] Review existing test patterns
- [ ] Identify mocking strategies for AI SDK
- [ ] Plan integration test approach
- [ ] Design observability instrumentation

## Key Questions by File Group

### Questions 1-4 (Architecture): 
**Files**: `package.json` files, `docs/architecture/packages.md`, `packages/api/src/routers/workflow.ts`, `packages/api/src/workflow/runner.ts`, `packages/api/src/run-registry.ts`

### Questions 5-8 (Integration):
**Files**: `packages/agent/src/orchestrator/flow/context.ts`, `packages/agent/src/v6.ts`, `packages/cognitive/src/*.ts`, `packages/knowledge/src/*.ts`, `packages/learning/src/*.ts`, `packages/policy/src/*.ts`

### Questions 9-12 (AI SDK):
**Files**: `packages/api/src/routers/assistant.ts`, `packages/api/src/routers/orchestrator.ts`, `packages/api/src/ai/normalize.ts`, `packages/api/src/ai/generate.ts`, `.ruler/15-ai-sdk-v6.md`

### Questions 13-16 (Performance):
**Files**: `packages/agent/src/orchestrator/flow/context.ts`, `packages/api/src/run-registry.ts`, `packages/db/src/repo/workflow.ts`, `packages/agent/src/util/token.ts`

### Questions 17-19 (Migration):
**Files**: `packages/api/src/workflow/runner.ts`, `packages/api/src/routers/workflow.ts`, `packages/api/src/run-registry.ts`, `.agent/plans/orchestrator-implementation-plan.md`

### Question 20 (Testing):
**Files**: `packages/api/test/*.test.ts`, `packages/api/test/utils/*.ts`, `.ruler/05-testing.md`

## Estimated Analysis Time

- **Architecture & Boundaries**: 2-3 hours
- **Integration Patterns**: 3-4 hours  
- **AI SDK Integration**: 2-3 hours
- **Performance & Migration**: 2-3 hours
- **Testing Strategy**: 1-2 hours

**Total**: ~10-15 hours of analysis before writing ExecPlan
