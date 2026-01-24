# Full Pipeline Testing Coverage Review

**Date:** 2025-01-27  
**Status:** Comprehensive Review Complete

## Executive Summary

This review analyzes integration and E2E testing coverage across ALFRED's full pipelines with minimal mocking. The codebase demonstrates strong testing infrastructure with VCR for AI providers, shared fixtures for voice/workflow runtime, and comprehensive E2E tests. However, significant gaps remain in end-to-end pipeline coverage, particularly for cross-boundary flows that span multiple subsystems.

### Key Findings

✅ **Strengths:**

- Excellent test infrastructure (VCR, fixtures, harnesses)
- Strong unit and component test coverage
- Good integration test patterns with minimal mocking
- Comprehensive E2E tests for UI interactions

⚠️ **Gaps:**

- Missing full pipeline E2E tests (Input → Orchestrator → Waves → Execution → Output)
- Limited cross-boundary integration tests
- Some integration tests use SQLite fallback (Postgres features untested)
- Voice pipeline tests skip due to dependency issues

## Pipeline Architecture Overview

ALFRED has four primary pipelines:

1. **Workflow Pipeline**: Scan → Plan → Act → Report phases with multi-agent orchestration
2. **Voice Pipeline**: STT → Assistant → TTS with bidirectional streaming
3. **Cognitive Pipeline**: Input → State transitions → Physiology → Autonomy → Output
4. **Knowledge Pipeline**: Capture → Synthesis → Graph → Retrieval

## Current Test Coverage Analysis

### 1. Workflow Pipeline Testing

#### Integration Tests (`packages/api/test/integration/workflow-pipeline.integration.test.ts`)

**Coverage:**

- ✅ Workflow streaming events (6 tests)
- ✅ Event persistence to database
- ✅ Authentication guards
- ✅ Workflow cancellation
- ✅ Context settings (RAG retrieval)

**Mocking Level:** Minimal

- Uses VCR for AI provider responses (OpenAI/Anthropic)
- Real database (SQLite in-memory)
- Real workflow runtime via `WorkflowTestHarness`
- Real orchestrator execution

**Gaps:**

- ❌ No tests for multi-agent wave execution
- ❌ No tests for conflict resolution (Arbiter)
- ❌ No tests for supervisor interrupts
- ❌ No tests for physiology updates during workflows
- ❌ No tests for suspend/resume with obligations
- ❌ No tests for Linear activity emissions

#### E2E Tests (`apps/web/tests/workflow-execution.e2e.spec.ts`)

**Coverage:**

- ✅ UI workflow initiation (chat node, droid node)
- ✅ Workflow history access
- ✅ Streaming response display
- ✅ Error handling (network errors, recovery)
- ✅ State persistence across reloads

**Mocking Level:** Minimal

- Real browser environment
- Real tRPC/SSE endpoints
- Mocked auth (test user signup)

**Gaps:**

- ❌ No tests for full workflow completion end-to-end
- ❌ No tests for workflow drawer with real run data
- ❌ No tests for workflow obligation flows (biometric elevation)

#### Workflow Streaming Integration (`packages/api/test/workflow.stream.integration.test.ts`)

**Coverage:**

- ✅ Both SSE and tRPC transports
- ✅ Policy enforcement
- ✅ Preference refresh logic
- ✅ Latency measurements (<100ms budget)

**Mocking Level:** Minimal

- Real orchestrator
- Real DB (SQLite fallback)
- Real streaming transports

### 2. Voice Pipeline Testing

#### Integration Tests (`packages/api/test/integration/voice-pipeline.integration.test.ts`)

**Coverage:**

- ⚠️ Voice session management (1 passing, 5 skipped)
- ⚠️ TTS synthesis (skipped due to pyarrow dependency conflict)
- ⚠️ Voice preview (skipped)

**Mocking Level:** Minimal (when pools initialize)

- Real voice pools (STT/TTS) when available
- Real VoiceRegistry
- Real IPC communication

**Issues:**

- Most tests skipped due to `pyarrow` dependency conflict
- Tests gracefully skip when voice pools fail to initialize
- No tests for full STT → Assistant → TTS flow

#### E2E Tests (`apps/web/tests/voice-session.e2e.spec.ts`)

**Coverage:**

- ✅ Full voice session lifecycle
- ✅ Audio streaming (binary WebSocket frames)
- ✅ STT transcription
- ✅ TTS synthesis
- ✅ Error handling (codec errors, timeouts)
- ✅ Concurrent sessions
- ✅ Session cleanup on disconnect

**Mocking Level:** Minimal

- Uses `createVoiceFixture` from `@alfred/test-kit`
- Real VoiceRegistry and pools
- Real WebSocket server
- Deterministic transcripts/chunks via fixture options

**Strengths:**

- Excellent example of minimal-mock E2E testing
- Tests real binary transport (not Base64 JSON)
- Tests real session lifecycle and cleanup

### 3. Cognitive Pipeline Testing

#### Unit Tests (`packages/cognitive/test/`)

**Coverage:**

- ✅ State transitions (`state-transitions.test.ts`)
- ✅ Physiology updates (`physiology.test.ts`)
- ✅ Performance budgets (`performance-budget.test.ts`)
- ✅ Synthesis logic (`synthesis.test.ts`)

**Mocking Level:** Pure functions (no mocking needed)

#### Integration Tests

**Coverage:**

- ⚠️ Limited integration tests for cognitive pipeline
- ⚠️ No tests for full cognitive loop (Input → State → Physiology → Autonomy → Output)

**Gaps:**

- ❌ No tests for cognitive state persistence
- ❌ No tests for autonomy gradient updates during workflows
- ❌ No tests for supervisor interrupt triggers
- ❌ No tests for physiology regulation affecting autonomy

#### E2E Tests (`apps/web/tests/cognitive-flow.e2e.spec.ts`)

**Coverage:**

- ✅ Cognitive feedback API bridge
- ✅ Normalized feedback submission

**Mocking Level:** Route mocking (not full pipeline)

**Gaps:**

- ❌ No full cognitive flow E2E tests
- ❌ No tests for cognitive state visualization
- ❌ No tests for physiology metrics display

### 4. Knowledge Pipeline Testing

#### Integration Tests

**Coverage:**

- ✅ Hypergraph traversal (`packages/knowledge/test/hypergraph.integration.test.ts`)
- ✅ Graph store operations (`packages/agent/assistant/test/graphstore.integration.test.ts`)
- ✅ RAG retrieval (`packages/api/test/graph.integration.test.ts`)

**Mocking Level:** Varies

- Some tests use real DB (Postgres)
- Some tests use SQLite fallback
- RAG tests may mock embeddings

**Gaps:**

- ❌ No tests for full knowledge pipeline (Capture → Synthesis → Graph → Retrieval)
- ❌ No tests for knowledge graph updates during workflows
- ❌ Limited tests for RAG retrieval performance budgets

### 5. Auth Flow Testing

#### Integration Tests (`packages/api/test/integration/auth-flow.integration.test.ts`)

**Coverage:**

- ✅ Session validation (4 tests)
- ✅ Token operations (2 tests)
- ✅ Profile operations (2 tests)
- ✅ Privacy operations (1 test)
- ✅ Route protection (multiple routes)
- ⚠️ CRUD operations (8 tests skipped due to SQLite limits)

**Mocking Level:** Minimal

- Real Better Auth
- Real database (SQLite in-memory)
- Real token issuance

**Issues:**

- Many tests skipped when using SQLite (tsvector, interval syntax)
- Tests should run against Postgres for full coverage

#### E2E Tests (`apps/web/tests/auth.e2e.spec.ts`)

**Coverage:**

- ✅ Sign up flow
- ✅ Sign in flow
- ✅ Session persistence
- ✅ Protected route access

**Mocking Level:** Minimal

- Real browser environment
- Real auth endpoints

## Test Infrastructure Analysis

### Test Fixtures and Harnesses

#### ✅ Voice Runtime Fixture (`packages/test-kit/src/voice/runtime-fixture.ts`)

**Purpose:** Provides deterministic voice testing with real VoiceRegistry and pools

**Features:**

- Configurable transcripts/chunks via options
- Real WebSocket server
- Automatic cleanup
- No mocking of core voice subsystems

**Usage:** Excellent pattern for minimal-mock testing

#### ✅ Workflow Runtime Fixture (`packages/test-kit/src/workflow/runtime-fixture.ts`)

**Purpose:** Provides workflow runtime testing with stubbed external boundaries

**Features:**

- Real workflow runtime execution
- Stubbed Linear HTTP (in-process server)
- Stubbed AI providers (configurable stream mode)
- Stubbed review gate (configurable failure mode)
- Real workflow repo (in-memory)

**Mocking Strategy:**

- ✅ Real: Workflow runtime, orchestrator, DB repo
- ⚠️ Stubbed: AI providers (via mock.module), Linear API, RAG, review gate
- ✅ Minimal: Only external boundaries mocked

**Assessment:** Good balance - mocks external boundaries while testing real runtime

#### ✅ Workflow Test Harness (`packages/api/test/utils/workflow-server.ts`)

**Purpose:** Provides in-process workflow testing with real auth

**Features:**

- Real Better Auth session patching
- Real tRPC caller creation
- Database reset utilities
- Request/response helpers

**Mocking Level:** Minimal (only auth session injection)

### VCR Infrastructure (`packages/test-kit/src/vcr/`)

**Purpose:** Records and replays AI provider responses

**Features:**

- Supports OpenAI, Anthropic, Google, Cohere
- Automatic authorization header redaction
- Request matching by hash
- Record/replay/passthrough modes

**Assessment:** Excellent for testing AI integrations without API costs

**Usage:**

```bash
VCR_RECORD=1 bun test my-test.ts  # Record
bun test my-test.ts               # Replay (default)
```

## Critical Gaps Identified

### 1. Full Pipeline E2E Tests (CRITICAL)

**Missing:** End-to-end tests that exercise complete pipelines from user input to final output

**Required Tests:**

#### Workflow Full Pipeline

```
Input → Orchestrator → Scan Phase → Plan Phase → Act Phase →
Multi-Agent Waves → Execution → Report Phase → Output
```

**Current State:**

- Integration tests cover individual phases
- No single test exercises full pipeline end-to-end
- `scripts/verify-full-pipeline.ts` exists but uses mock model

**Recommendation:** Create `packages/api/test/integration/workflow-full-pipeline.integration.test.ts` that:

- Uses VCR for AI providers
- Exercises all four phases sequentially
- Tests multi-agent wave execution
- Verifies physiology updates
- Tests supervisor interrupts
- Tests conflict resolution

#### Voice Full Pipeline

```
Audio Input → STT → Assistant Processing → TTS → Audio Output
```

**Current State:**

- E2E tests cover voice session lifecycle
- No test exercises full STT → Assistant → TTS flow with real assistant

**Recommendation:** Create `packages/api/test/integration/voice-assistant-pipeline.integration.test.ts` that:

- Uses voice fixture for STT/TTS
- Uses real assistant for processing
- Tests full round-trip latency
- Verifies audio quality

#### Cognitive Full Pipeline

```
Input → State Transition → Physiology Update → Autonomy Update → Output
```

**Current State:**

- Unit tests cover individual components
- No integration test exercises full cognitive loop

**Recommendation:** Create `packages/api/test/integration/cognitive-full-pipeline.integration.test.ts` that:

- Tests state persistence
- Tests physiology regulation
- Tests autonomy gradient updates
- Tests supervisor interrupts

### 2. Cross-Boundary Integration Tests (HIGH PRIORITY)

**Missing:** Tests that verify subsystems work together correctly

**Required Tests:**

1. **Workflow + Cognitive Integration**
   - Workflow execution triggers cognitive state updates
   - Physiology affects workflow autonomy decisions
   - Supervisor interrupts workflows

2. **Workflow + Knowledge Integration**
   - Workflows update knowledge graph
   - Knowledge retrieval informs workflow planning
   - RAG provenance links to workflow reasoning

3. **Voice + Workflow Integration**
   - Voice input triggers workflows
   - Workflow output synthesized as voice
   - Voice session persists workflow context

4. **Workflow + Linear Integration**
   - Workflow execution emits Linear activities
   - Linear webhooks trigger workflows
   - Workflow status updates Linear issues

### 3. Postgres-Backed Integration Tests (MEDIUM PRIORITY)

**Current State:**

- Many integration tests use SQLite fallback
- Postgres-specific features untested (tsvector, interval syntax, vector search)

**Required:**

- Run integration tests against Postgres in CI
- Use `createTestDb`/`closeTestDb` for isolation
- Test Postgres-specific features (full-text search, vector similarity, temporal queries)

**Recommendation:**

- Add `test:integration:postgres` command
- Run Postgres integration tests in nightly CI
- Document Postgres vs SQLite test coverage

### 4. Performance Budget Assertions (MEDIUM PRIORITY)

**Current State:**

- Some performance tests exist (`cognitive/test/performance-budget.test.ts`)
- Limited performance assertions in integration tests

**Required:**

- Assert performance budgets in all integration tests
- Database queries <10ms (p99)
- Workflow streaming latency <100ms
- Voice pipeline latency < real-time requirements

**Recommendation:**

- Add performance assertions to integration test helpers
- Fail tests that exceed budgets
- Track performance metrics in CI

### 5. Error Path Testing (MEDIUM PRIORITY)

**Current State:**

- Some error handling tests exist
- Limited tests for failure scenarios

**Required:**

- Test supervisor interrupts (low entropy, zombie processes)
- Test conflict resolution (merge conflicts)
- Test workflow timeouts
- Test service degradation (DB unavailable, voice pools down)

**Recommendation:**

- Add chaos testing scenarios
- Test graceful degradation patterns
- Test error recovery flows

## Mocking Analysis

### Current Mocking Patterns

#### ✅ Good Patterns (Minimal Mocking)

1. **VCR for AI Providers**
   - Records real API responses
   - Replays deterministically
   - Only mocks external boundaries

2. **Voice Fixture**
   - Real VoiceRegistry and pools
   - Configurable transcripts/chunks
   - No mocking of core subsystems

3. **Workflow Harness**
   - Real workflow runtime
   - Real database
   - Only mocks external boundaries (Linear, AI providers)

#### ⚠️ Areas for Improvement

1. **Workflow Runtime Fixture**
   - Mocks AI providers (via `mock.module`)
   - Should use VCR instead for more realistic testing

2. **RAG Mocking**
   - Some tests mock RAG retrieval
   - Should test real RAG retrieval with VCR for embeddings

3. **Review Gate Mocking**
   - Review gate stubbed in workflow fixture
   - Should test real review gate logic

### Recommendations

1. **Replace AI Provider Mocks with VCR**
   - Use VCR in workflow runtime fixture
   - Record real AI responses for deterministic testing
   - Remove `mock.module` for AI providers

2. **Test Real RAG Retrieval**
   - Use VCR for embedding providers
   - Test real hybrid search
   - Verify performance budgets

3. **Test Real Review Gate**
   - Use real review gate logic
   - Configure review gate via fixture options
   - Test review gate failures

## Test Coverage Metrics

### Integration Tests

| Pipeline  | Tests    | Passing | Skipped | Failing | Coverage |
| --------- | -------- | ------- | ------- | ------- | -------- |
| Workflow  | 6        | 3       | 0       | 3       | Partial  |
| Voice     | 6        | 1       | 5       | 0       | Low      |
| Auth      | 19       | 11      | 8       | 0       | Partial  |
| Cognitive | 0        | 0       | 0       | 0       | None     |
| Knowledge | Multiple | Varies  | Varies  | Varies  | Partial  |

### E2E Tests

| Area      | Tests     | Coverage  |
| --------- | --------- | --------- |
| Workflow  | 10        | Good      |
| Voice     | 6         | Excellent |
| Auth      | 15        | Good      |
| Cognitive | 1         | Low       |
| Mindscape | Extensive | Excellent |

## Recommendations

### Immediate Actions (Critical)

1. **Create Full Pipeline Integration Tests**
   - `workflow-full-pipeline.integration.test.ts`
   - `voice-assistant-pipeline.integration.test.ts`
   - `cognitive-full-pipeline.integration.test.ts`

2. **Fix Voice Pipeline Tests**
   - Resolve `pyarrow` dependency conflict
   - Enable skipped voice integration tests
   - Add full STT → Assistant → TTS flow test

3. **Add Cross-Boundary Integration Tests**
   - Workflow + Cognitive
   - Workflow + Knowledge
   - Voice + Workflow

### High Priority

4. **Postgres-Backed Integration Tests**
   - Add `test:integration:postgres` command
   - Run Postgres tests in nightly CI
   - Test Postgres-specific features

5. **Performance Budget Assertions**
   - Add performance assertions to integration tests
   - Track performance metrics in CI
   - Fail tests that exceed budgets

6. **Error Path Testing**
   - Add chaos testing scenarios
   - Test supervisor interrupts
   - Test conflict resolution
   - Test graceful degradation

### Medium Priority

7. **Improve Mocking Patterns**
   - Replace AI provider mocks with VCR
   - Test real RAG retrieval
   - Test real review gate logic

8. **Expand E2E Coverage**
   - Add cognitive flow E2E tests
   - Add knowledge pipeline E2E tests
   - Add cross-boundary E2E tests

## Conclusion

ALFRED has strong testing infrastructure with excellent patterns for minimal-mock testing. The VCR system, shared fixtures, and test harnesses provide a solid foundation. However, significant gaps remain in full pipeline coverage, particularly for end-to-end flows that span multiple subsystems.

**Priority Focus Areas:**

1. Full pipeline integration tests
2. Cross-boundary integration tests
3. Postgres-backed integration tests
4. Performance budget assertions
5. Error path testing

**Next Steps:**

1. Create ExecPlan for full pipeline testing
2. Implement full pipeline integration tests
3. Fix voice pipeline test issues
4. Add Postgres-backed integration test suite
5. Add performance budget assertions

## References

- `.ruler/05-testing.md` - Testing standards
- `docs/testing/critical-testing-gaps.md` - Existing gap analysis
- `docs/testing/implementation-summary.md` - Test infrastructure summary
- `packages/test-kit/` - Test fixtures and utilities
- `packages/api/test/integration/` - Integration test examples
