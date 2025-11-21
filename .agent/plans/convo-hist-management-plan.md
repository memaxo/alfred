# Token-aware Conversation History Management: Design and Integration Plan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

This plan designs and introduces an adaptive, token-aware history clamping and pruning strategy that is model-aware, budgeted, and prioritizes critical context, while allowing incremental rollout across the three existing call sites.

## Progress

Use a list with checkboxes to summarize granular steps. Every stopping point must be documented here, even if it requires splitting a partially completed task into two ("done" vs. "remaining"). This section must always reflect the actual current state of the work.

- [x] (2025-11-21 00:25Z) Create new package `packages/history` with package.json and tsconfig.json
- [x] (2025-11-21 00:29Z) Implement `packages/history/src/types.ts` with HistoryTier, HistoryBudget, BuildHistoryContextOptions, HistorySelection, and BuildHistoryContextResult types
- [x] (2025-11-21 00:29Z) Implement `packages/history/src/model.ts` with getModelContextInfo() function and model registry
- [x] (2025-11-21 00:29Z) Implement `packages/history/src/history-context.ts` with buildHistoryContext() function and selection algorithm
  - Ensure proper use of convertToModelMessages with optional parameters
  - Ensure proper use of pruneMessages with minimal settings
  - Follow AI SDK v6 alignment guidelines (section 2.5)
- [x] (2025-11-21 00:29Z) Implement `packages/history/src/index.ts` barrel exports
- [x] (2025-11-21 00:38Z) Add metrics to `packages/api/src/metrics.ts`: historyContextTokensTotal, historyContextTierDropsTotal, historyContextSelectionDurationSeconds
- [x] (2025-11-21 00:38Z) Add metrics to `packages/runtime/src/metrics.ts`: runtimeHistoryTokensTotal, runtimeHistoryTierDropsTotal, runtimeHistorySelectionDurationSeconds
- [x] (2025-11-21 00:38Z) Integrate buildHistoryContext in `apps/web/src/routes/api/stream-handler.ts`
- [x] (2025-11-21 00:38Z) Integrate buildHistoryContext in `packages/runtime/src/adapters/ai.ts`
- [x] (2025-11-21 00:38Z) Extend `packages/api/src/ai/messages.ts` prepareModelMessagesForGenerate() to accept model/system parameters
- [x] (2025-11-21 00:38Z) Integrate buildHistoryContext in `packages/api/src/ai/messages.ts`
- [x] (2025-11-21 00:38Z) Update `packages/api/src/routers/assistant.ts` to pass model and system to prepareModelMessagesForGenerate()
- [x] (2025-11-21 00:38Z) Update `packages/api/src/routers/orchestrator.ts` to pass model and system to prepareModelMessagesForGenerate()
- [x] (2025-11-21 00:38Z) Add environment variable documentation to config/env.example
- [x] (2025-11-21 00:38Z) Write tests for packages/history selection algorithm
- [x] (2025-11-21 00:38Z) Write integration tests for all three call sites
- [x] (2025-11-21 00:52Z) Validate metrics collection and observability

Use timestamps to measure rates of progress.

## Surprises & Discoveries

Document unexpected behaviors, bugs, optimizations, or insights discovered during implementation. Provide concise evidence.

- Observation: Metrics consumers needed direct access to per-message tiers to emit drop counters without recomputing rank order.
  Evidence: Added `tierByMessage` WeakMap on `HistorySelection` and consumed it inside web/runtime/API integrations when emitting tier drop metrics.
- Observation: Repository-wide `bun test` run fails prior to our changes because Playwright suites and embedding workers require local browsers and model downloads that are unavailable in this environment.
  Evidence: `bun test` exited with Playwright `test.describe()` initialization errors plus embed pool timeouts before reaching our new tests.
- Observation: `bun run typecheck` is currently blocked by pre-existing TypeScript errors in packages such as `@alfred/db`, `@alfred/knowledge`, and the new voice streaming work.
  Evidence: `tsc -b` reported issues in `packages/db/src/client.ts`, `packages/knowledge/src/indices/*`, and `packages/api/src/voice/streaming.ts` unrelated to the history implementation.

## Decision Log

Record every decision made while working on the plan in the format:

- Decision: [Decision description]
  Rationale: [Why this decision was made]
  Date/Author: [Timestamp and author]

- Decision: Added `tierByMessage` WeakMap to `HistorySelection` so downstream services can emit tiered metrics without guessing IDs.
  Rationale: Metrics require reliable tier lookups for the actual message objects, and relying on ID heuristics failed when IDs are missing.
  Date/Author: 2025-11-21 / Codex
- Decision: Introduced `getHistoryBudgetDefaults()` helper in `@alfred/history` to centralize env parsing of ratio/reserve knobs.
  Rationale: Each call site needed identical logic, so centralizing it avoids divergence and simplifies future tuning.
  Date/Author: 2025-11-21 / Codex
- Decision: Switched tests to spy on real metric instances instead of fully mocking `@alfred/api/metrics`.
  Rationale: The metrics module exports dozens of counters; maintaining bespoke mocks caused brittle failures. Spies keep assertions while honoring the real surface.
  Date/Author: 2025-11-21 / Codex

## Outcomes & Retrospective

Summarize outcomes, gaps, and lessons learned at major milestones or at completion. Compare the result against the original purpose.

Completed the shared history package, metrics instrumentation, and all three integrations (web SSE, runtime adapter, API generate). Added unit coverage for the selector plus integration coverage for each caller. `bun test` currently fails upstream because of Playwright and embedding dependencies, and `bun run typecheck` is blocked by pre-existing database/knowledge/voice errors; both were documented above. Token-aware selection now drives all model invocations and emits observability signals for future tuning.

---

## 1) High-level Design

Goal: Replace count-based clamping with a token-aware history selection pipeline that adapts to model context windows, preserves critical context (anchors), applies priority tiers, and optionally hooks into summarization and memory in the future.

### Inputs
- UI messages: UIMessage[]
- Model identity: string (e.g., openai/gpt-4o-mini)
- Optional system string (preference/system prompt)
- Optional overrides:
  - historyRatio: number (fraction of model context to allocate to history)
  - minSystemReserveTokens: number (reserve for system/preference prompt)
  - minHeadroomTokens: number (reserve for current step/tool use)
  - forceKeep: Set of message IDs (future: user "pinning")
  - budget overrides via env/config

### Derived model constraints
- maxContextTokens from a model registry (mapping modelId → max context tokens) with environment override support.
- historyBudgetTokens = floor(modelMaxContextTokens × historyRatio) − reserves
  - reserves include system prompt tokens, tooling overhead (provider-dependent), and headroom for the current turn.

### Token estimation
- Use existing estimator: createTokenEstimator() from @alfred/agent/orchestrator/util/token.
- Fall back to heuristic (chars/4) when tokenizer is unavailable.
- Estimate:
  - systemTokens = estimator.estimate(system ?? "")
  - messageTokens = sum of parts:
    - For text parts: text
    - For tool-call/result: compact JSON.stringify(part) or minimal serialization (input/output omitted details is future work)
  - Keep an LRU cache for per-message token estimates.

### Priority & anchoring strategy
- Anchors (must-keep):
  - Latest user message(s) (the current request)
  - The most recent complete tool chain (contiguous block containing the latest tool-call(s) and tool-result(s))
  - Optionally, the immediately preceding assistant message that contextualizes the last user message
  - System/preference prompt is not a UI message but part of the reserved budget
- Priority tiers for the rest:
  - High: recent user clarifications; assistant answers tied to current topic
  - Medium: recent, non-tool assistant/user turns
  - Low: older chit-chat, stale tool outputs
- Scoring:
  - Base role weight: user > assistant > tool-only messages
  - Recency weight (time-decay): newer = higher score
  - Tool chain proximity: messages adjacent to the latest tool-chain get a bonus
  - Latest tool chain messages are treated atomically (don’t split the chain)
  - Future: respect explicit user “pinned” messages (forceKeep set)

### Selection pipeline
1. Compute budget:
   - modelMaxContextTokens → historyBudgetTokens = floor(maxContextTokens × historyRatio) − (systemTokens + minHeadroomTokens + provider/tooling reserve).
2. Load anchors:
   - Last user message (and possibly last 2 if very short).
   - Latest tool chain (contiguous assistant tool-call + tool-result block).
   - Preceding assistant message if present (bridges to the last user message).
   - Compute anchorTokens.
   - If anchorTokens > historyBudgetTokens, keep anchors but mark “over-budget” (favor anchors; this rare case suggests summarization need).
3. Fill remaining budget:
   - Rank remaining messages by priority score (high → low, recency-biased).
   - Add messages in reverse chronological order until budget exhausted.
   - Treat tool result groups atomically when adding/dropping.
4. Optional post-pass:
   - If a single message is a large outlier relative to remaining budget, and non-anchor, optionally summarize (future hook).
5. Convert to ModelMessage[] using `ai.convertToModelMessages` ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md)) and run a minimal `ai.pruneMessages` post-pass ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_prune-messages.md)):
   - Keep emptyMessages: "remove"
   - Optionally relax "reasoning/toolCalls" pruning since we've already budgeted; or keep existing settings initially for backward compatibility.
6. Metrics:
   - keptTokens, droppedTokens
   - keptCount, droppedCount
   - per-tier kept/dropped counts
   - selection details (for logs, not metrics)
7. Output:
   - uiMessages: UIMessage[] kept (ordered ascending)
   - modelMessages: ModelMessage[] generated for AI SDK
   - droppedMessages: count
   - keptTokens, droppedTokens, selection summary flags

### Optional summarization & memory (future work)
- Trigger summarization when:
  - History overflows frequently, and a single or group of messages occupies > X% of budget, or the same topic continues across many turns.
  - The latest tool chain is huge and repeats patterns; produce a “tool result summary” with identified facts/outcomes.
- Where to put summaries:
  - Inline “assistant” summary message replacing 3+ very old messages (clearly marked as Summary).
  - Additionally persist key facts to knowledge graph via persistKnowledge/persistReasoning (packages/agent/assistant/src/graphstore.ts).
- Guardrails:
  - Keep summary prompts/outputs small; include provenance (message ids/timestamps).
  - Summary drift mitigation by periodic refresh on new relevant content.
- Not part of MVP; designed as an extension point.

---

## 2) API Proposal

Introduce a centralized function for token-aware history building in a new shared module.

New package: packages/history

New file: packages/history/src/history-context.ts
- Purpose: Centralize token-aware budgeting, prioritization, and selection
- Interfaces:

```ts
// packages/history/src/types.ts
export type HistoryTier = "anchor" | "high" | "medium" | "low";

export type HistoryBudget = {
  modelId: string;
  maxContextTokens: number;        // from registry
  historyRatio?: number;           // default via config (e.g., 0.5)
  minSystemReserveTokens?: number; // default ~2k
  minHeadroomTokens?: number;      // default ~2k
  reservedToolingTokens?: number;  // default ~1k (provider dependent, conservative)
};

export type BuildHistoryContextOptions = {
  messages: UIMessage[];
  modelId: string;
  system?: string;
  budget?: Partial<HistoryBudget>;
  source?: "assistant" | "orchestrator" | "stream-handler" | string;
  // future:
  forceKeepIds?: Set<string>;
  // knobs:
  aggressive?: boolean; // tighter budgeting in cost-sensitive envs
};

export type HistorySelection = {
  kept: UIMessage[];
  dropped: UIMessage[];
  tiers: Map<string, HistoryTier>;
  keptTokens: number;
  droppedTokens: number;
  budget: {
    modelId: string;
    maxContextTokens: number;
    historyBudgetTokens: number; // computed
    systemTokens: number;
    headroomTokens: number;
  };
};

export type BuildHistoryContextResult = {
  uiMessages: UIMessage[];  // ascending chronological
  modelMessages: ModelMessage[];
  droppedMessages: number;
  keptTokens: number;
  droppedTokens: number;
  selection: HistorySelection;
};
```

```ts
// packages/history/src/model.ts
export type ModelContextInfo = {
  maxContextTokens: number;
  defaultHistoryRatio?: number; // e.g., 0.5
};

// resolves from config/registry/env with sensible defaults
export function getModelContextInfo(modelId: string): ModelContextInfo;
```

```ts
// packages/history/src/history-context.ts
import { createTokenEstimator } from "@alfred/agent/orchestrator/util/token";
// AI SDK v6 functions: convertToModelMessages (docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md)
//                      pruneMessages (docs/reference/ai-sdk-v6/reference_ai-sdk-ui_prune-messages.md)
import { convertToModelMessages, pruneMessages } from "ai";
import type { UIMessage, ModelMessage } from "@alfred/type/stream";
import { getModelContextInfo } from "./model";
import type {
  BuildHistoryContextOptions,
  BuildHistoryContextResult,
  HistorySelection,
} from "./types";

export async function buildHistoryContext(
  options: BuildHistoryContextOptions
): Promise<BuildHistoryContextResult> {
  // 1) resolve model max tokens + compute history budget
  // 2) estimate systemTokens + message token costs
  // 3) identify anchors (last user, latest tool chain, adjacent assistant)
  // 4) priority-rank the rest (role, recency, tool proximity)
  // 5) select messages into budget (atomic chains), track kept/dropped
  // 6) convertToModelMessages() then pruneMessages() - see AI SDK v6 alignment (section 2.5)
  // 7) return result + selection metadata
}
```

```ts
// packages/history/src/index.ts
export * from "./types";
export * from "./model";
export * from "./history-context";
```

Model context lookup with env override:

```ts
// packages/history/src/model.ts
export function getModelContextInfo(modelId: string): ModelContextInfo {
  // Resolve from a static map + env override JSON:
  //   HISTORY_MODEL_CONTEXT='{"openai/gpt-4o":128000,"openai/gpt-4o-mini":128000}'
  // Fallback to 128k if unknown.
}
```

Semantics and returns:
- Keeps all anchor messages even if budget slightly exceeded; logs over-budget condition and emits tokens dropped vs kept.
- Provides selection.tiers mapping for observability (anchor/high/medium/low).

---

## 2.5) AI SDK v6 Alignment

This plan aligns with AI SDK v6 patterns and correctly uses the framework's native utilities. The following considerations ensure proper integration:

**References**: See `docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md`, `docs/reference/ai-sdk-v6/reference_ai-sdk-ui_prune-messages.md`, `docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md`, and `docs/reference/ai-sdk-v6/migration-guides_migration-guide-5-0.md` for official documentation.

### Native Function Usage

**convertToModelMessages**: The plan correctly uses `convertToModelMessages` from the `ai` package to convert `UIMessage[]` to `ModelMessage[]` ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md)). When implementing `buildHistoryContext`, ensure proper handling of optional parameters:

```ts
// In buildHistoryContext implementation
const modelMessages = convertToModelMessages(selectedUiMessages, {
  // Optional: Provide tools if multi-modal tool responses are needed
  // tools: options.tools,
  // Optional: Convert custom data parts (data-url, data-code-file, etc.)
  // convertDataPart: (part) => {
  //   if (part.type === 'data-url') {
  //     return { type: 'text', text: `[${part.data.title}](${part.data.url})` };
  //   }
  //   return null; // Filter out unhandled data parts
  // },
});
```

**pruneMessages**: The plan uses `pruneMessages` from the `ai` package for post-conversion cleanup ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_prune-messages.md)). This function handles reasoning/tool-call removal, not token budgeting. Use minimal settings since token-aware selection already handles budgeting:

```ts
// After convertToModelMessages in buildHistoryContext
const prunedModelMessages = pruneMessages({
  messages: modelMessages,
  emptyMessages: "remove", // Remove empty messages after conversion
  // Optionally relax reasoning/toolCalls pruning since we've already budgeted:
  // reasoning: "none", // Keep reasoning if budget allows
  // toolCalls: "none", // Keep tool calls if budget allows
});
```

### Order of Operations

The correct flow is:
1. `UIMessage[]` (input with parts structure)
2. Token-aware selection on `UIMessage[]` (preserves parts structure)
3. `convertToModelMessages()` → `ModelMessage[]` ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md))
4. `pruneMessages()` → cleaned `ModelMessage[]` ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_prune-messages.md))
5. Pass to `streamText()` → `ModelMessage[]` ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md))

This order ensures:
- Token estimation works on `UIMessage[]` parts before conversion
- Selection preserves message integrity (tool chains stay atomic)
- Conversion happens after selection to avoid unnecessary work
- Pruning removes empty/redundant content after conversion

### Type System Alignment

- **Input**: `UIMessage[]` with full `parts` structure (text, tool-call, tool-result, reasoning, file, data-* parts) ([reference](docs/reference/ai-sdk-v6/ai-sdk-ui_chatbot.md))
- **Output**: `ModelMessage[]` compatible with `streamText()` ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md))
- **Type changes**: `Message` → `UIMessage`, `CoreMessage` → `ModelMessage`, `convertToCoreMessages` → `convertToModelMessages` ([reference](docs/reference/ai-sdk-v6/migration-guides_migration-guide-5-0.md))
- **Validation**: Use `validateUIMessages()` before token-aware selection if needed

### AI SDK v6 Compatibility Notes

- AI SDK v6 does not provide built-in token-aware history management, so this custom solution is appropriate and complementary
- The plan correctly distinguishes between `UIMessage[]` (UI state) and `ModelMessage[]` (provider format) ([reference](docs/reference/ai-sdk-v6/ai-sdk-ui_chatbot.md))
- All message part types align with AI SDK v6 canonical types (text, reasoning, tool-call, tool-result, file, source-url, source-document, data-*, step-start) ([reference](docs/reference/ai-sdk-v6/ai-sdk-ui_chatbot.md), [reference](docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md))
- The implementation does not conflict with AI SDK v6's built-in features (`pruneMessages` handles different concerns than token budgeting) ([reference](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_prune-messages.md))

### Implementation Checklist

When implementing `buildHistoryContext`, ensure:
- [ ] Token estimation works on `UIMessage[]` parts before conversion
- [ ] Tool chains are preserved atomically during selection
- [ ] `convertToModelMessages` is called with appropriate options if custom data parts need handling
- [ ] `pruneMessages` is called with minimal settings (emptyMessages: "remove" at minimum)
- [ ] Returned `ModelMessage[]` is compatible with `streamText()` requirements
- [ ] Both `uiMessages` (for UI state) and `modelMessages` (for AI SDK) are returned

---

## 3) Integration Plan

We will integrate the new builder at three call sites, replacing existing message clamping logic.

### A) SSE streaming (apps/web/src/routes/api/stream-handler.ts)

Current:
- Uses pruneMessagesForStream(messages) from apps/web/src/routes/api/history.ts
- Injects preference system prompt

Changes:
- Replace call with buildHistoryContext

Exact location:
- apps/web/src/routes/api/stream-handler.ts, around message clamping and prompt injection (lines 108–160 of provided snippet)

Proposed modifications:
- Imports:
  - import { buildHistoryContext } from "@alfred/history";
  - import { getModelId } from "@alfred/agent"; // already present
  - Add metrics from @alfred/api/metrics (see Metrics section)
- Replace:

```ts
const { uiMessages: preparedUiMessages, modelMessages, dropped } =
  pruneMessagesForStream(messages);
```

with:

```ts
const modelId = getModelId();
const ctx = await buildHistoryContext({
  messages,
  modelId,
  system: preferencePrompt,
  source: errorPrefix,
  budget: {
    historyRatio: Number(process.env.HISTORY_CONTEXT_RATIO ?? "0.5"),
    minSystemReserveTokens: Number(process.env.HISTORY_MIN_SYSTEM_RESERVE ?? "2000"),
    minHeadroomTokens: Number(process.env.HISTORY_MIN_HEADROOM ?? "2000"),
  },
});

const preparedUiMessages = ctx.uiMessages;
const modelMessages = ctx.modelMessages;
const dropped = ctx.droppedMessages;
const keptTokens = ctx.keptTokens;
const droppedTokens = ctx.droppedTokens;
```

- Immediately after, record metrics:
  - preferenceHistoryPrunedTotal.inc({ source: errorPrefix }, dropped);
  - historyContextTokensTotal.inc({ source: errorPrefix, model: modelId, action: "kept" }, keptTokens);
  - historyContextTokensTotal.inc({ source: errorPrefix, model: modelId, action: "dropped" }, droppedTokens);

- Keep downstream behavior unchanged:
  - Pass modelMessages to streamText
  - Keep current AI SDK pruneMessages run (our builder already prunes; we can leave it as is for safety)

### B) Runtime/orchestrator adapter (packages/runtime/src/adapters/ai.ts)

Current:
- limitUiMessages() → validateUIMessages() → convertToModelMessages() → pruneMessages() → streamText()

Changes:
- Replace limitUiMessages() with buildHistoryContext()

Exact location:
- packages/runtime/src/adapters/ai.ts, in AISDKAdapter.stream()

Proposed modifications:
- Imports:
  - import { buildHistoryContext } from "@alfred/history";
  - import type { ModelMessage } from "@alfred/type/stream";
  - import { runtimeHistoryTokensTotal, runtimeHistoryTierDropsTotal } from "../metrics"; // new metrics
- Replace the block that calculates limitedMessages, validated, model/pruned:

```ts
const inputMessages = Array.isArray(options.messages) ? options.messages : [];
const limitedMessages = limitUiMessages(inputMessages);
const dropped = inputMessages.length - limitedMessages.length;
// ...
const validatedMessages = (await validateUIMessages({ messages: limitedMessages, tools: options.tools as ... })) as UIMessage[];
const modelMessages = convertToModelMessages(validatedMessages);
const prunedMessages = pruneMessages({ ... });
```

with:

```ts
const inputMessages = Array.isArray(options.messages) ? options.messages : [];

const ctx = await buildHistoryContext({
  messages: inputMessages,
  modelId: modelId, // already computed earlier
  system: systemPrompt, // merged system prompt above
  source: "runtime-ai-adapter",
  budget: {
    historyRatio: Number(process.env.HISTORY_CONTEXT_RATIO ?? "0.5"),
    minSystemReserveTokens: Number(process.env.HISTORY_MIN_SYSTEM_RESERVE ?? "2000"),
    minHeadroomTokens: Number(process.env.HISTORY_MIN_HEADROOM ?? "2000"),
  },
});

const selectedUi = ctx.uiMessages;
const modelMessages = ctx.modelMessages;

// Metrics
runtimeHistoryTokensTotal.inc({ action: "kept" }, ctx.keptTokens);
runtimeHistoryTokensTotal.inc({ action: "dropped" }, ctx.droppedTokens);
```

- Then pass modelMessages to streamText as before.

### C) Assistant/orchestrator generate routes (packages/api/src/ai/messages.ts)

Current:
- prepareModelMessagesForGenerate({ rawMessages, tools, source }) validates UI, clamps via limitUiMessages, converts, pruneMessages, returns ModelMessage[]

Changes:
- Extend this helper to accept model (LanguageModel | string) to compute budget.
- Replace limitUiMessages with buildHistoryContext.

File: packages/api/src/ai/messages.ts
- Update type and function signature:

```ts
type PrepareMessagesArgs = {
  rawMessages: unknown[];
  tools?: Record<string, Tool>;
  source: "assistant" | "orchestrator";
  model?: string | LanguageModel; // NEW
  system?: string; // optional to include preference prompt tokens in budget if available
};
```

- Inside prepareModelMessagesForGenerate():

```ts
const modelId = typeof args.model === "string" ? args.model : 
                (args.model as any)?.id ?? "openai/gpt-4o-mini";

const validated = (await validateUIMessages({ messages: rawMessages, tools: tools as ... })) as UIMessage[];
const ctx = await buildHistoryContext({
  messages: validated,
  modelId,
  system: args.system,
  source,
  budget: {
    historyRatio: Number(process.env.HISTORY_CONTEXT_RATIO ?? "0.5"),
    minSystemReserveTokens: Number(process.env.HISTORY_MIN_SYSTEM_RESERVE ?? "2000"),
    minHeadroomTokens: Number(process.env.HISTORY_MIN_HEADROOM ?? "2000"),
  },
});

// record metrics in @alfred/api/metrics.ts
historyContextTokensTotal.inc({ source, model: modelId, action: "kept" }, ctx.keptTokens);
historyContextTokensTotal.inc({ source, model: modelId, action: "dropped" }, ctx.droppedTokens);
return ctx.modelMessages;
```

- Update callers to pass model:
  - packages/api/src/routers/assistant.ts:
    - In generate mutation:
      - const defaults = getAssistantAgentDefaults();
      - pass model: defaults.model (string ok) and system: any injected preference prompt (if available in this route; otherwise omit).
  - packages/api/src/routers/orchestrator.ts:
    - Similar: pass defaults.model and any system prompt if used.

---

## 4) Metrics & Observability Plan

Add new counters/histograms to understand token budgets, selections, and tier impact. Keep existing preferenceHistoryPrunedTotal for message count continuity.

A) API-side metrics (packages/api/src/metrics.ts)
- New:
  - historyContextTokensTotal (Counter)
    - name: "history_context_tokens_total"
    - help: "Total tokens processed by history selection grouped by source, model, and action."
    - labels: ["source", "model", "action"] where action ∈ {"kept","dropped"}
  - historyContextTierDropsTotal (Counter)
    - name: "history_context_tier_drops_total"
    - help: "Count of messages dropped grouped by source and tier."
    - labels: ["source", "tier"] where tier ∈ {"anchor","high","medium","low"}
  - historyContextSelectionDurationSeconds (Histogram)
    - name: "history_context_selection_duration_seconds"
    - help: "Duration of token-aware history selection by source."
    - labels: ["source"]
    - buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1]
  - historySummarizationsTotal (Counter) [future]
    - name: "history_summarizations_total"
    - labels: ["source", "reason"]

B) Runtime-side metrics (packages/runtime/src/metrics.ts)
- New:
  - runtimeHistoryTokensTotal (Counter)
    - name: "runtime_history_tokens_total"
    - labels: ["action"] where action ∈ {"kept","dropped"}
  - runtimeHistoryTierDropsTotal (Counter)
    - name: "runtime_history_tier_drops_total"
    - labels: ["tier"]
  - runtimeHistorySelectionDurationSeconds (Histogram)
    - name: "runtime_history_selection_duration_seconds"
    - labels: []
- Note: Separate names to avoid duplicate registration conflicts and to follow naming in runtime.

C) Suggested dashboards/queries
- Token budget usage:
  - sum by model, source of history_context_tokens_total{action="kept"} vs dropped
  - rate over time by route
- Tier loss impact:
  - history_context_tier_drops_total by tier to ensure low > medium >> high >> anchor
- Latency:
  - history_context_selection_duration_seconds p50/p95
- Downstream signals (heuristic validation):
  - Increase in tool re-calls per conversation after drops? (requires correlation to ai events)
  - Increase in user complaints: detect messages containing “you forgot”, “we already discussed”
  - Combine with runtimeAiSdkDurationSeconds to watch for slowdown

---

## Files to Add / Modify

### New files (new package)
- packages/history/src/types.ts
  - Defines HistoryTier, HistoryBudget, BuildHistoryContextOptions/Result types
- packages/history/src/model.ts
  - getModelContextInfo(modelId): resolve max context from mapping + env override
  - model defaults table
- packages/history/src/history-context.ts
  - Implements token-aware selection algorithm using createTokenEstimator
  - Exports buildHistoryContext()
- packages/history/src/index.ts
  - Barrel exports
- packages/history/package.json, tsconfig.json (standard minimal package scaffold)

### Existing files to modify
- apps/web/src/routes/api/stream-handler.ts
  - Replace pruneMessagesForStream usage with buildHistoryContext
  - Add metrics emissions
- packages/runtime/src/adapters/ai.ts
  - Replace limitUiMessages block with buildHistoryContext
  - Record runtimeHistoryTokensTotal
- packages/api/src/ai/messages.ts
  - Extend prepareModelMessagesForGenerate signature to accept model/system
  - Replace limitUiMessages with buildHistoryContext
- packages/api/src/routers/assistant.ts
  - Pass model: defaults.model and optional system to prepareModelMessagesForGenerate
- packages/api/src/routers/orchestrator.ts
  - Pass model: defaults.model and optional system
- packages/api/src/metrics.ts
  - Add: historyContextTokensTotal, historyContextTierDropsTotal, historyContextSelectionDurationSeconds, historySummarizationsTotal (future)
- packages/runtime/src/metrics.ts
  - Add: runtimeHistoryTokensTotal, runtimeHistoryTierDropsTotal, runtimeHistorySelectionDurationSeconds

---

## 5) Logic and Reasoning Behind Modifications

- Centralizing history building:
  - Avoids duplicating budget logic across 3 call sites
  - Prepares for future summarization/memory integration
- Model-aware budget:
  - Derived from model max context via registry + env override control
- Token-aware selection:
  - Reflects real cost (token counts), not message count
  - Preserves critical anchors and tool chains atomically to maintain reasoning continuity
- Priority-based degradation:
  - Drop low-signal content first; degrade gracefully under budget pressure
- Post-processing:
  - Leave AI SDK pruneMessages minimal to avoid unintentional second pruning

---

## 6) Example Signatures and Usage

- buildHistoryContext:

```ts
const ctx = await buildHistoryContext({
  messages,
  modelId: "openai/gpt-4o-mini",
  system: preferencePrompt,
  source: "stream-handler",
  budget: { historyRatio: 0.5, minSystemReserveTokens: 2000, minHeadroomTokens: 2000 },
});

const { uiMessages, modelMessages, keptTokens, droppedTokens } = ctx;
```

- prepareModelMessagesForGenerate change:

```ts
export async function prepareModelMessagesForGenerate({
  rawMessages,
  tools,
  source,
  model, // optional
  system, // optional
}: PrepareMessagesArgs): Promise<ModelMessage[]> { /* ... */ }
```

Callers:

```ts
// packages/api/src/routers/assistant.ts
const defaults = getAssistantAgentDefaults();
const modelMessages = await prepareModelMessagesForGenerate({
  rawMessages: input.messages,
  tools: defaults.tools,
  source: "assistant",
  model: defaults.model, // string or LanguageModel
  system: /* optional system prompt if available */,
});
```

---

## 7) Potential Side Effects and Architectural Decisions

- Complexity increase: more code and a selection path to maintain/observe
- Token estimation latency: use withBudget("build_history_context", ~10ms)
  - If estimator is slow/missing, fallback to heuristic estimation
- Provider/tool overhead:
  - We reserve headroom for system and tooling; provider specifics vary
- AI SDK pruneMessages:
  - Keep minimal settings initially; adjust after confirming builder correctness
- Memory/summarization:
  - Not implemented now; designed entry points to integrate later with @alfred/knowledge

Guardrails:
- Time budget: wrap selection with withBudget("history_selection", 10)
- Configuration defaults: conservative reserves; surface env overrides for tuning

---

## 8) Trade-offs & Risk Analysis

- What we lose vs simple scheme:
  - Simplicity. More moving parts and configuration.
- Risks:
  - Token estimates may be off; but consistent estimation is usually sufficient for relative selection
  - Latency increases; mitigated with withBudget + caching
  - Mis-prioritization: fine-tune weights if metrics show high-tier drops
  - Double pruning: coordinate with AI SDK prune step; start conservatively and adjust

Mitigations:
- Rich metrics to analyze token budgets and tier drops

---

## 9) Configuration

- HISTORY_CONTEXT_RATIO=0.5
- HISTORY_MIN_SYSTEM_RESERVE=2000
- HISTORY_MIN_HEADROOM=2000
- HISTORY_MODEL_CONTEXT='{"openai/gpt-4o":128000,"openai/gpt-4o-mini":128000,"anthropic/claude-3-5-sonnet":200000}'

---

## 10) Optional Future Enhancements

- Summarization module:
  - summarizeHistory(messagesChunk) → summaryMessage (assistant/system)
  - Integrate with @alfred/agent/preference to retain domain preferences during summary
- Memory persistence:
  - Extract facts from older history via @alfred/knowledge/extractor and persist via persistKnowledge
  - On selection, prefer recalling knowledge facts over repeating long history

---

## Appendix: Critical Code Locations

- apps/web/src/routes/api/stream-handler.ts
  - Replace pruneMessagesForStream usage; record kept/dropped tokens; keep existing metrics and extend
- packages/api/src/ai/messages.ts
  - Update prepareModelMessagesForGenerate() to accept model/system and use buildHistoryContext
- packages/api/src/routers/assistant.ts
  - Pass defaults.model/system into prepareModelMessagesForGenerate()
- packages/api/src/routers/orchestrator.ts
  - Same as above
- packages/runtime/src/adapters/ai.ts
  - Replace limitUiMessages() path with buildHistoryContext(); record runtime metrics
- packages/api/src/metrics.ts and packages/runtime/src/metrics.ts
  - Add metrics described above

---

## References: AI SDK v6 Documentation

This plan references the following AI SDK v6 documentation files:

- **Message Conversion**: `docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md` - `convertToModelMessages()` function for converting `UIMessage[]` to `ModelMessage[]`
- **Message Pruning**: `docs/reference/ai-sdk-v6/reference_ai-sdk-ui_prune-messages.md` - `pruneMessages()` function for removing reasoning/tool-call content
- **Streaming**: `docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md` - `streamText()` function and `ModelMessage[]` format requirements
- **Chatbot Guide**: `docs/reference/ai-sdk-v6/ai-sdk-ui_chatbot.md` - `UIMessage[]` structure with `parts` property and message part types
- **Migration Guide**: `docs/reference/ai-sdk-v6/migration-guides_migration-guide-5-0.md` - Type system changes (`Message` → `UIMessage`, `CoreMessage` → `ModelMessage`)

---

This plan brings conversation history into parity with how we already treat repository and RAG context: as a scarce resource managed by budget and prioritized selection. It leverages existing token-estimation utilities and sets the stage for summarization and knowledge integration.
