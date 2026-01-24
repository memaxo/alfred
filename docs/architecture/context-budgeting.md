# Context Budgeting Architecture

## Overview

ALFRED manages LLM context window limits by intelligently pruning message history while preserving critical context. This enables long conversations without hitting token limits or degrading quality.

## Core Implementation

**Primary function:** `buildHistoryContext` from `@alfred/history` (`packages/history/src/history-context.ts`)

**Purpose:** Selects which messages to include in the LLM context window based on:

- Token budget constraints
- Message importance (anchors, tool chains, recent messages)
- Aggressive vs. conservative pruning strategies

## Budget Resolution

The system calculates available tokens for history:

```typescript
const budget = resolveBudget(
  options,
  modelContext, // Model's max context window
  systemTokenCount // System prompt token count
);
```

**Budget components:**

- `maxContextTokens`: Model's maximum context window size
- `minSystemReserve`: Reserved tokens for system prompt (default: 2000)
- `minHeadroom`: Safety buffer to avoid overflow (default: 2000)
- `reservedTooling`: Tokens reserved for tool calls/responses (default: 1000)
- `historyRatio`: Fraction of available tokens for history (default: 0.5, range: 0.05-0.95)

**Formula:**

```
availableTokens = maxContextTokens - systemTokens - minHeadroom - reservedTooling
historyBudget = availableTokens * historyRatio
```

## Message Selection Strategy

### Tier System

Messages are assigned tiers based on importance:

- **High tier**: Recent messages (last N), anchor messages (force-kept), active tool chains
- **Medium tier**: Messages within tool chains, recent user messages
- **Low tier**: Older messages, assistant-only messages

### Aggressive Pruning Mode

When `aggressive: true` (used in voice assistant for latency):

- Prioritizes recent messages and tool chains
- More aggressive removal of older, lower-tier messages
- Faster selection algorithm (fewer passes)

**Usage:** Voice assistant (`packages/api/src/voice/assistant.ts` line 457):

```typescript
const historyContext = await buildHistoryContext({
  messages: allMessages,
  modelId: modelIdStr,
  system: systemInstructions,
  aggressive: true, // Be aggressive with pruning for voice latency
});
```

### Conservative Pruning Mode

When `aggressive: false` (default for chat):

- Preserves more historical context
- More careful tier-based selection
- Better for maintaining long-term conversation coherence

## Anchor Messages

**Anchors** are messages that must be preserved regardless of age:

- Explicitly marked via `forceKeepIds` parameter
- Tool chain roots (messages that initiated tool sequences)
- Critical decision points

**Implementation:** Messages with `isAnchor: true` are always included in the selected set.

## Tool Chain Preservation

**Tool chains** are sequences of tool calls and results:

- **Root**: User message that initiated the tool call
- **Chain**: Tool call → tool result → assistant response
- **Preservation**: Entire chains are kept together (all-or-nothing)

**Rationale:** Tool results are meaningless without their corresponding calls.

## Token Estimation

**Estimator:** `createTokenEstimator` from `@alfred/metrics/token`

**Method:** Model-specific token counting:

- Uses model's tokenizer when available
- Falls back to character-based estimation
- Accounts for message structure (role, parts, tool calls)

**Role weights:** Different message roles have different token costs:

- `user`: 3x weight (more verbose)
- `assistant`: 2x weight
- `tool`: 1x weight
- `system`: 1x weight

## Usage Locations

### Voice Assistant

**File:** `packages/api/src/voice/assistant.ts`

**Strategy:** Aggressive pruning for low latency

- Prunes aggressively to keep response times fast
- Preserves recent context and active tool chains
- Trade-off: May lose older context for speed

### Chat Interfaces

**Files:** `apps/web/src/hooks/use-chat-logic.ts`, `apps/native/hooks/use-chat-logic.ts`

**Strategy:** Conservative pruning (default)

- Preserves more historical context
- Better for maintaining conversation coherence
- Trade-off: May hit token limits in very long conversations

### Workflow Planning

**File:** `packages/runtime/src/context.ts` (via `buildHistoryContext`)

**Strategy:** Context-dependent

- Uses history context for plan generation
- May use aggressive mode for fast planning
- Preserves tool chains and decision points

## Performance Budgets

**Budget enforcement:** `withBudget` wrapper from `@alfred/metrics/performance`

**Target:** `<10ms` for history context building

**Measurement:** `build_history_context_<source>` histogram metric

## Configuration

**Environment variables:**

- `HISTORY_RATIO`: Fraction of tokens for history (default: 0.5)
- `MIN_SYSTEM_RESERVE`: Reserved system tokens (default: 2000)
- `MIN_HEADROOM`: Safety buffer (default: 2000)

**Per-call options:**

- `aggressive`: Enable aggressive pruning (default: false)
- `forceKeepIds`: Message IDs to always include
- `maxHistoryTokens`: Override calculated budget

## Related Concepts

- **Continuity layers**: See [`continuity-layers.md`](./continuity-layers.md) for how conversation state persists
- **Context types**: See [`docs/definitions/context.md`](../definitions/context.md) for Window/Artifact/Domain context
- **Token metrics**: See `packages/metrics/src/token.ts` for token counting implementation
