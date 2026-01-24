# @alfred/history

Token-aware conversation history management with dynamic budget calculation and cost tracking.

## Overview

This package provides:

- **Model Registry**: Comprehensive registry of 40+ LLM models with verified context windows, pricing, and capabilities
- **Budget Calculator**: Dynamic budget calculation based on model specifications and research-backed ratios
- **Usage Tracker**: Per-session token usage and cost tracking with Prometheus metrics integration
- **History Context Builder**: Intelligent message pruning and context selection

## Model Registry

The registry (`registry.ts`) provides a centralized source of truth for model capabilities:

```typescript
import { getModelSpec, resolveModelId } from "@alfred/history";

// Resolve aliases to canonical IDs
const canonicalId = resolveModelId("gpt-4o"); // "openai/gpt-4o"

// Get model specification
const spec = getModelSpec("openai/gpt-4o");
console.log(spec?.capabilities.maxContextTokens); // 128000
console.log(spec?.pricing.inputPer1M); // 2.5
```

### Model Information

Each model spec includes:

- **Context Window**: Maximum input tokens (with extended context support)
- **Max Output**: Maximum output tokens
- **Pricing**: Input/output/cached/reasoning rates per 1M tokens
- **Capabilities**: Tool calling, vision, structured outputs
- **Recommended History Ratio**: Model-specific optimal history allocation

## Budget Calculator

Dynamic budget calculation scales reserves based on model context window:

```typescript
import { calculateBudget } from "@alfred/history";

const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });

console.log(budget.maxContextTokens); // 200000
console.log(budget.historyBudgetTokens); // ~110000 (55% of 200k)
console.log(budget.systemReserveTokens); // 16000 (8%)
console.log(budget.headroomTokens); // 30000 (15%)
```

### Budget Components

- **System Reserve**: 8% of context (min 2k) - for system prompts
- **Headroom**: 15% of context (min 2k) - buffer for generation
- **Tooling Reserve**: 6% of context (min 1k) - for tool calls/results
- **History Budget**: Remaining tokens (55% default, 45% for reasoning models)

### Research-Backed Ratios

Budget allocations are based on:

- "Lost in the Middle" phenomenon (degradation at 85% utilization)
- Primacy and recency bias (prefer start/end of context)
- Model-specific recommendations (reasoning models use lower ratios)

## Usage Tracker

Track token usage and costs per session:

```typescript
import { getOrCreateTracker } from "@alfred/history";

const tracker = getOrCreateTracker({
  sessionId: "chat-123",
  modelId: "openai/gpt-4o",
  budgetUsd: 10.0,
});

// Record usage after model call
tracker.record({
  modelId: "openai/gpt-4o",
  inputTokens: 5000,
  outputTokens: 2000,
  cachedTokens: 3000,
  reasoningTokens: 0,
  latencyMs: 500,
});

// Check budget status
const status = tracker.getBudgetStatus();
console.log(status.status); // "healthy" | "warning" | "critical" | "exceeded"
console.log(status.usedUsd); // 0.045
console.log(status.remainingUsd); // 9.955
```

### Prometheus Metrics

The tracker automatically exposes Prometheus metrics:

- `history_tokens_input_total` - Total input tokens
- `history_tokens_output_total` - Total output tokens
- `history_tokens_cached_total` - Total cached tokens
- `history_tokens_reasoning_total` - Total reasoning tokens
- `history_cost_usd_total` - Total cost in USD
- `history_budget_remaining_gauge` - Remaining budget
- `history_budget_utilization_gauge` - Budget utilization percentage
- `history_latency_ms_histogram` - Request latency

## History Context Builder

Intelligent message pruning based on tiered importance:

```typescript
import { buildHistoryContext } from "@alfred/history";

const context = await buildHistoryContext({
  messages: allMessages,
  modelId: "openai/gpt-4o",
  system: systemPrompt,
  aggressive: false, // Use default ratios
});

console.log(context.uiMessages.length); // Pruned message list
console.log(context.keptTokens); // Tokens kept
console.log(context.droppedTokens); // Tokens dropped
```

### Message Tiers

Messages are assigned tiers based on importance:

- **Anchor**: User's most recent message (always kept)
- **High**: Tool calls/results, user messages
- **Medium**: Assistant responses, system messages
- **Low**: Older messages (pruned first)

## API Integration

### Voice Assistant

```typescript
import { getOrCreateTracker } from "@alfred/history";

const tracker = getOrCreateTracker({
  sessionId: threadId,
  modelId: modelIdStr,
  budgetUsd: 1.0,
});

tracker.record({
  modelId: modelIdStr,
  inputTokens: usage.inputTokens ?? 0,
  outputTokens: usage.outputTokens ?? 0,
  cachedTokens: usage.cachedInputTokens ?? 0,
  reasoningTokens: usage.reasoningTokens ?? 0,
  latencyMs: durationSeconds * 1000,
});
```

### Stream Handler

```typescript
import { calculateBudget, getOrCreateTracker } from "@alfred/history";

const budget = calculateBudget({ modelId });
const tracker = getOrCreateTracker({
  sessionId: conversationId,
  modelId,
  budgetUsd: options.maxCostUsd,
});
```

### Metrics Router

```typescript
import { getAggregateStats, getTracker } from "@alfred/history";

// Get budget status for a session
const tracker = getTracker(sessionId);
const status = tracker?.getBudgetStatus();

// Get aggregate stats across all sessions
const stats = getAggregateStats();
```

## Environment Variables

```bash
# Default history ratio (0.15-0.75, default: 0.55)
HISTORY_CONTEXT_RATIO=0.55

# Minimum system reserve tokens (default: 2000)
HISTORY_MIN_SYSTEM_RESERVE=2000

# Minimum headroom tokens (default: 2000)
HISTORY_MIN_HEADROOM=2000

# Optional: Override model context windows
# HISTORY_MODEL_CONTEXT={"openai/gpt-4o":128000}
```

## Testing

Run tests with:

```bash
bun test packages/history
```

Test coverage includes:

- Model registry lookup and alias resolution
- Budget calculation scaling and edge cases
- Usage tracking and cost calculation
- Prometheus metrics integration

## See Also

- `@alfred/metrics` - Cost calculation and pricing data
- `@alfred/type/model` - Model type definitions
- `packages/api/src/routers/metrics.ts` - Budget status API endpoints
