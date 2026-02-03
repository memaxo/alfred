# Context management hardening (unified budget, compression, RAG budgeting, tool truncation, metrics)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

ALFRED currently constructs LLM calls from multiple context sources (system prompts, RAG chunks, message history, tool schemas/results) with only partial budgeting and no message compression. In long, tool-heavy, or RAG-heavy conversations this causes token waste (sending redundant text and oversized tool outputs) and quality risk (dropping whole messages instead of compressing, or letting one source dominate the budget).

After this change, ALFRED will have a single, end-to-end context management pipeline that:

- Computes and enforces one unified token budget across all context sources.
- Compresses older messages (instead of just dropping them) when budgets are tight.
- Enforces a strict RAG injection budget with relevance-aware selection and truncation.
- Truncates oversized tool results (> 4k tokens) into a summary + AgentFS reference to the full output.
- Emits metrics that make context utilization, compression effectiveness, and pruning impact observable in production.

User-visible proof:

- In a fixed benchmark conversation set, the average prompt tokens sent to the LLM drop by **30%+** with **no regression** in basic quality proxies (anchor retention, tool-chain integrity, RAG inclusion where available).
- In a running server, `/api/metrics` contains the new context metrics and shows **context utilization staying under 85%** (safety ceiling) while maintaining stable response behavior.

## Progress

- [ ] (2026-02-03) Establish a deterministic “contextbench” harness that measures per-source tokens and total prompt tokens on a fixed fixture set (baseline before changes + after changes).
- [ ] Implement `ContextBudgetManager` as a single source of truth for allocations + utilization tracking; emit allocation/utilization metrics.
- [ ] Replace fragmented budget wiring in `packages/api/src/stream-handler.ts` with `ContextBudgetManager` (system parts + tools + history).
- [ ] Add message compression layer (extractive + rolling summary) integrated before tier pruning; gated by `CONTEXT_COMPRESSION_ENABLED`.
- [ ] Integrate RAG budgeting into `packages/api/src/ai/assistant-context.ts` with relevance-aware selection under a passed budget; add `rag_budget_exceeded_total` metric.
- [ ] Implement tool result truncation (> 4k tokens) with summary + AgentFS reference; apply at persistence time and at context-build time; add `tool_result_truncated_total` metric.
- [ ] Add observability metrics (`context_compression_ratio`, `context_quality_score`, `dropped_message_tiers`, budget metrics); add a minimal “how to read these” note in this ExecPlan.
- [ ] Add/extend unit tests for each phase; ensure `bun test packages/history/ packages/api/test/` passes.
- [ ] Demonstrate 30%+ token reduction on the fixture benchmark and document the results in `Outcomes & Retrospective`.

## Surprises & Discoveries

- (none yet)

## Decision Log

- Decision: Keep the existing “utilization target” semantics in `@alfred/history` budgets (default `historyRatio = 0.55` is a conservative total-context utilization target), but make the budget manager explicitly track and enforce per-source caps so one source (RAG/tool results/preferences) cannot silently eat the whole budget.
  Rationale: This preserves today’s intentional safety margin while addressing the real failure mode: uncoordinated sources and oversized payloads.
  Date/Author: 2026-02-03 / GPT-5.2

- Decision: Tool-result truncation will be applied in two places: (1) before persisting messages to the DB (so we stop storing massive tool outputs in `conversation_messages`), and (2) during context preparation (for backward compatibility with existing stored messages and to handle mid-stream tool results).
  Rationale: Persistence-time truncation prevents unbounded storage growth and ensures future turns are naturally token-efficient; context-time truncation protects immediate model calls and handles legacy data.
  Date/Author: 2026-02-03 / GPT-5.2

- Decision: Use extractive compression as the default message compressor (sentence selection) and treat Python LongCodeZip summarization as a best-effort “rolling summary” tier with heuristic fallback and caching.
  Rationale: Extractive compression is deterministic and fast; Python summarization is valuable but must not break latency or availability, and must pass tests with `ALFRED_SUMMARIZE_OFFLINE=1`.
  Date/Author: 2026-02-03 / GPT-5.2

- Decision: Compression triggers when _history usage_ exceeds a threshold (`0.92`) of the allocated history budget, rather than on total model-context utilization.
  Rationale: The tight point is typically the history budget; this avoids compressing prematurely while preventing cliff-edge drops once pruning starts.
  Date/Author: 2026-02-03 / GPT-5.2

- Decision: Store full, truncated tool outputs in AgentFS KV under a stable key derived from `{conversationId|sessionId}+toolCallId+sha256(payload)`, and include only the key (not the full output) in the truncated tool-result payload.
  Rationale: KV is already JSON-serialisable, access-controlled through existing AgentFS plumbing, and avoids inventing a new storage system.
  Date/Author: 2026-02-03 / GPT-5.2

## Outcomes & Retrospective

- (not started)

## Context and Orientation

### Key terms (plain language)

- Token: A model-dependent unit of text. We estimate tokens using `createTokenEstimator()` from `@alfred/metrics/token` so estimates reflect the selected model.
- Context window: The maximum combined input+output token window supported by the model (example: 128k).
- Budget: A per-request allocation of tokens to each context source so we can keep the prompt small, stable, and predictable.
- System prompt: Instructions given to the model outside the message history. In ALFRED this is assembled from several sources (persona prompt, preferences, domain instructions, and sometimes RAG injections).
- RAG chunk: A piece of retrieved knowledge-base text that may be injected into the prompt.
- Tool schema: The definitions/descriptions/schemas for tools passed into the model call. These consume prompt tokens even before a tool is used.
- Tool result: The output produced by executing a tool. Tool results can be extremely large (file contents, logs) and must be truncated for context safety.
- Pruning: Dropping whole messages/groups to fit a token budget.
- Compression: Rewriting content to be shorter while preserving key information (extractive sentence selection; rolling summary).
- Tier: The importance class used for history selection: `anchor > high > medium > low`.

### Current (pre-change) call flow and the “gaps”

Streaming chat/orchestrator endpoints:

- `packages/api/src/assistant.ts` and `packages/api/src/orchestrator.ts` call `packages/api/src/stream-handler.ts` (`handleStreamRequest()`).
- `handleStreamRequest()`:
  - normalizes inbound message shapes to AI SDK v6 `UIMessage[]`
  - persists messages to DB via `persistMessages()` → `@alfred/db/repo/conversation.createMessage()` (currently unbounded)
  - builds a preference system prompt via `packages/agent/src/preference/prompt.ts` (currently unbounded)
  - computes a model budget via `packages/history/src/calculator.ts` (`calculateBudget()`)
  - prunes history via `packages/history/src/history-context.ts` (`buildHistoryContext()`)
  - calls `streamText()` with:
    - `system: combinedSystem`
    - `messages: modelMessages` (from `buildHistoryContext()`)
    - `tools: toolsForStream` (tool schema tokens currently not accounted for)

Non-stream generation (used by other server surfaces):

- `packages/api/src/ai/messages.ts` (`prepareModelMessagesForGenerate()`) validates UI messages, then calls `buildHistoryContext()` to produce `ModelMessage[]`.

RAG context injection:

- `packages/api/src/ai/assistant-context.ts` (`buildAssistantContextWithDeps()`) retrieves context chunks and appends them to the system prompt with **no token budgeting**, meaning:
  - injected RAG can bloat the system prompt, reducing available history budget (or worse: overflowing when budget assumptions don’t include it)
  - low-relevance chunks can crowd out high-value context

History pruning:

- `packages/history/src/history-context.ts` prunes by tier+recency and preserves tool chains, but it only **drops** messages; it does not compress, and it serializes tool parts with `safeJson(payload)` which can be extremely large.

Identified weaknesses this plan addresses (from `docs/architecture/context-management-overview.md`):

- No message compression / no rolling summary.
- RAG context not budgeted.
- Tool result truncation missing.
- Preference prompt unbounded.
- Multiple system prompt sources uncoordinated.
- No context quality observability / metrics to quantify impact.
- No streaming-aware pruning (no mid-stream adjustments when tool results appear).

## Plan of Work

### Milestone 0: Baseline harness (“contextbench”) and fixtures

Goal: Make “30%+ token reduction” provable and repeatable without requiring live model calls.

Work:

- Add a deterministic benchmark script at `scripts/contextbench-context.ts` that:
  - loads a fixed set of fixture conversations from `packages/history/test/fixtures/contextbench/*.json`
  - runs the current context pipeline (budget → history context → final prompt build) in two modes:
    - baseline mode: compression/truncation disabled (feature flags off)
    - new mode: compression/truncation enabled
  - prints a compact report per fixture:
    - modelId + maxContextTokens
    - per-source token usage (system persona/preferences/domain/RAG; tool schemas; history; headroom)
    - history kept/dropped counts by tier
    - compression ratio and tokens saved
    - tool truncations count
    - final “prompt tokens” estimate

- Pick fixtures that stress the real failure modes:
  - empty conversation
  - long conversation (50+ turns) with several long user messages
  - tool-heavy conversation with at least one extremely large tool result
  - RAG-enabled conversation with multiple chunks

Acceptance:

- Running `bun run scripts/contextbench-context.ts` at repo root prints a report for each fixture and a final summary including the percent token reduction between modes.

### Milestone 1: Unified context budget manager (allocations + utilization + metrics)

Goal: Create one source of truth that knows “how many tokens each source gets” and “how many tokens each source used,” and make both visible via metrics.

Work:

- Create `packages/history/src/budget-manager.ts` exporting `ContextBudgetManager`.
- Extend `packages/history/src/types.ts` with the minimal new types needed for budgeting and reporting (keep the existing `HistoryBudget`, `HistorySelection`, `HistoryTier` stable; add new types instead of breaking callers).
- `ContextBudgetManager` responsibilities:
  - Construct from `{ modelId, maxContextTokens?, historyRatio?, systemTokens? }` and reuse `calculateBudget()` as the baseline allocator for:
    - total/effective context tokens
    - system reserve
    - tooling reserve
    - headroom reserve
    - history budget (remaining)
  - Track system prompt sources separately (at minimum: persona, preferences, domain instructions, RAG injection) and expose:
    - `registerSystemPart(source, text)` → `{ text, tokens, truncated }`
  - Track RAG injection separately and enforce a token cap by selection/truncation:
    - `selectRagChunks({ chunks, budgetTokens, estimator })` → `{ selected, dropped, truncated, usedTokens }`
  - Track tool schema token usage and enforce by trimming optional tools first:
    - `enforceToolBudget(tools)` → `{ tools, droppedToolNames, usedTokens }`
  - Compute a snapshot summary used for metrics/logging:
    - allocations (tokens per source)
    - used (tokens per source)
    - utilization ratios per source and overall

- Budget contract (make this explicit in `ContextBudgetManager` docs + tests):
  - Total context window is `effectiveContextTokens` from `calculateBudget()`.
  - The “utilization target” is the same `historyRatio` used today (default `0.55`), meaning we target:
    - `targetTotalTokens = floor(effectiveContextTokens * historyRatio)`
  - Within that target, the baseline allocations are:
    - `systemBudgetTokens = systemReserveTokens` (8% scaled, minimum enforced by calculator)
    - `toolSchemaBudgetTokens = toolingReserveTokens` (6% scaled, minimum enforced)
    - `headroomTokens = headroomTokens` (15% scaled, minimum enforced; reserved for output, not sent)
    - `historyBudgetTokens = historyBudgetTokens` (computed remainder: the part of the utilization target available for message history after reserves)
  - Enforcement order when system prompt is over budget:
    - First truncate/compress **preferences** (they are optional formatting guidance).
    - Then reduce **RAG injection** (drop low-relevance chunks; truncate an oversized chunk).
    - Then truncate **domain instructions** (if still needed).
    - Never truncate the **base persona** below a small floor; if persona itself is too large, treat it as a bug and log loudly.
  - “No source exceeds its budget” is interpreted as “we actively rewrite/drop within each source until its token count is ≤ its allocation; we do not silently steal from history budget except as an explicit last-resort path guarded by a metric and log line.”

- Preference prompt bounding (must be implemented at the source, not by naive string slicing):
  - Extend `buildPreferenceSystemPrompt()` in `packages/agent/src/preference/prompt.ts` to accept an optional budget input (tokens or chars), for example:
    - `buildPreferenceSystemPrompt(userId, context?: DomainContext & { maxTokens?: number })`
  - When a budget is provided:
    - Prefer dropping low-priority preference entries rather than truncating mid-entry.
    - Always keep “response.\*” preferences first (verbosity/tone/format/explanation depth), then domain-specific preferences.
    - If still over budget, collapse into a compact single-paragraph form (no long examples).
  - Record a metric (or a budget-manager “truncated=true” signal) when preferences were shortened so the effect is measurable.

- Tool schema token estimation contract:
  - The manager must produce a deterministic estimate for tool schemas that is cheap enough for per-request use.
  - Use a stable serialization of each tool definition (sorted by tool name) capturing only:
    - tool name
    - description
    - JSON schema for parameters (or the Zod-JSON representation the tool already exposes)
  - Estimate tokens on the serialization using `createTokenEstimator({ model: modelId })`.
  - If over budget, drop tools in this order:
    - dynamically loaded MCP tools
    - tools with the largest schema token cost
    - finally, any tool not present in the “core catalog” returned by `getDefaults()`
  - Emit a metric label that records how many tools were dropped and which strategy was used (so we can debug capability regressions).

- Add metrics in `packages/history/src/metrics.ts`:
  - `context_budget_allocation` (event-style counter/histogram, per source + model)
  - `context_budget_utilization` (histogram of utilization ratios, per source + model)

- Integrate into `packages/api/src/stream-handler.ts`:
  - Replace “ad hoc” budget passing with:
    - create a `ContextBudgetManager` once per request (after model selection)
    - build system prompt parts through the manager (persona/contextSystem/preferences)
    - enforce tool schema budget on `mergedTools`
    - call `buildHistoryContext()` using budgets derived from the manager (instead of passing raw `calculateBudget()` outputs around)
  - Ensure we still pass `system: combinedSystem` into `streamText()` and pass `messages: modelMessages`.
  - Add streaming-aware enforcement by composing `prepareStep`:
    - Wrap tool execution to truncate oversized tool outputs at the source (so the tool-result content inserted by AI SDK is already bounded).
    - Then wrap `prepareStep` to run a lightweight “step budget check” that:
      - estimates current prompt token usage (system + model messages + tool schemas)
      - if usage is near the safety ceiling, drops the oldest non-essential model messages while preserving:
        - the last user message
        - the latest tool call/result chain
        - the last assistant message
      - emits a metric whenever a mid-stream drop occurs
    - Ensure this wrapper composes cleanly with the existing signals `prepareStep` injection (run signals injection first, then budget enforcement so the final step config fits the budget).

Acceptance:

- `handleStreamRequest()` emits budget metrics for each request and logs a small, structured summary when pruning/compression/truncation occurs.
- The build still typechecks and `bun test packages/api/test/ai.messages.test.ts` passes (update mocks if needed).

### Milestone 2: Tool result truncation with AgentFS reference

Goal: Prevent oversized tool results from dominating token budgets and storage, while still preserving the full output for internal debugging/recovery.

Work:

- Create `packages/history/src/tool-truncation.ts` exporting pure helpers:
  - `shouldTruncateToolResult(estimator, part, maxTokens)` (default maxTokens = 4000)
  - `summarizeToolPayload(payload)` (fast extractive summary for JSON/text)
  - `truncateToolPart(part, { summary, ref })` (returns a new tool-result part whose `output` becomes `{ summaryText, ref }`)

- Add API-layer storage in `packages/api/src/stream-handler.ts`:
  - In `persistMessages()`, before `conversationRepo.createMessage(...)`, scan message parts:
    - if a tool-result payload estimates > 4k tokens, store the full payload in AgentFS KV and replace the persisted tool-result output with the truncated form.
  - Storage details:
    - Use `createRunAgentFS(conversationId, "api-stream")` from `@alfred/agent/agentfs` (lazy, best-effort).
    - Store KV key like `toolresult:${toolCallId}:${sha256}` with value `{ toolName, toolCallId, createdAt, payload }`.
    - Persist only the KV key reference in the conversation message (not the full payload).
    - If AgentFS is unavailable, degrade gracefully: truncate without reference and increment a “fallback” label metric.
  - Security and leakage control:
    - The truncated payload must not include raw secrets or any full content fragments beyond the summary.
    - Use an “internal reference” shape that is unlikely to be repeated back to the user (e.g., `ref: { kind: "agentfs_kv", runId: conversationId, key }` rather than a bare URL).
    - Add/extend the base system persona instruction to explicitly forbid emitting internal refs/IDs verbatim (this is a safety belt, not a guarantee).

- Add history-layer protection:
  - Update `serializePart()` in `packages/history/src/history-context.ts` to use the truncation helper when serializing tool parts for token estimation (so anchors don’t look infinitely large, and estimates align with what we send).
  - In `buildHistoryContext()`, ensure the actual `UIMessage[]` returned to the model contains truncated tool parts when needed (even if legacy DB entries still contain large payloads).

- Add metrics:
  - `tool_result_truncated_total` counter (labels: `source`, `toolName`, `stored: "agentfs" | "none"`)

Acceptance:

- A unit test in `packages/history/test/tool-truncation.test.ts` verifies:
  - tool results above the threshold are truncated
  - the output contains a stable `{ summaryText, ref }` shape
- An API test in `packages/api/test/stream-handler.truncation.test.ts` (or similar) verifies:
  - persisting a large tool-result message stores a reference and does not write the full payload to DB
  - the request does not fail when AgentFS is unavailable

### Milestone 3: Message compression layer (extractive + rolling summary) integrated before pruning

Goal: Reduce token usage in long conversations while preserving key information by compressing older history instead of dropping it.

Work:

- Create `packages/history/src/compression.ts` exporting:
  - `compressHistoryMessages({ messages, modelId, budgetTokens, thresholdRatio })`
  - Extractive compressor:
    - Keep the last 10 messages unmodified (“full fidelity”).
    - For older messages, compress only when history usage exceeds 92% of the allocated history budget.
    - Sentence selection scoring (EXIT-inspired): keep primacy/recency sentences, sentences containing errors, file paths, code fences, and numeric/structured content; drop filler. Make the scoring deterministic and easy to reason about:
      - Always keep the first 1-2 sentences and the last 1-2 sentences (primacy/recency).
      - Add weight to sentences that match any of:
        - looks like an error (`error`, `failed`, stack traces, HTTP status codes)
        - contains code fences or inline code
        - contains file paths (e.g. `/`, `.ts`, `.tsx`, `.md`)
        - contains numbers/IDs (helps preserve concrete details)
      - Enforce a per-message cap (e.g., keep ≤ 40% of original tokens, bounded by a fixed max) so one old message can’t dominate.
  - Rolling summary tier:
    - For “very old” messages (configurable; start with “older than 40 messages from the end”), replace the oldest slice with a single summary message.
    - Use `@alfred/summarize.summarize()` with `ALFRED_SUMMARIZE_OFFLINE=1` compatibility and cache by `{firstMessageId,lastMessageId,modelId}` so it does not re-run every turn.
    - Time-budget the LongCodeZip call: if summarization does not complete within the compression budget, fall back to the heuristic extractive summary for that slice and record a metric label `method="rolling_summary_fallback"`.
  - Emergency truncation (required for correctness):
    - If a single _anchor_ message (especially the last user message) exceeds the entire available history budget, never drop it, but rewrite its text parts into:
      - a short “head” (first N tokens)
      - a short “tail” (last N tokens)
      - an extractive “highlights” block between them
    - Emit a distinct metric label so these cases are visible; they should be rare and treated as a user-input/UX problem upstream.

- Integrate compression into `buildHistoryContext()`:
  - Apply tool truncation first (so tool payloads don’t explode the compressor).
  - Apply message compression **before** the tier-based grouping/pruning.
  - Gate the entire compression layer behind `process.env.CONTEXT_COMPRESSION_ENABLED === "1"` (default off for rollout).
  - Add a separate `withBudget(..., 100, ...)` budget guard for compression work, and keep the existing selection/pruning work under a 10ms budget (split the function if needed so the 10ms budget remains meaningful).

- Emit compression metrics:
  - `context_compression_ratio` histogram (labels: `source`, `method: "extractive" | "rolling_summary" | "none"`)
  - Reuse `historySummarizationsTotal` for rolling summary events with clear `reason` labels.

Acceptance:

- New tests in `packages/history/test/compression.test.ts`:
  - last 10 messages remain unchanged
  - compression activates only above the 92% threshold
  - rolling summary is produced and cached (run twice; second run does not call summarize again)
  - tests pass with `ALFRED_SUMMARIZE_OFFLINE=1`

### Milestone 4: RAG budget integration in assistant context builder

Goal: Ensure retrieved chunks never exceed an allocated budget and are selected by relevance under that budget.

Work:

- Modify `packages/api/src/ai/assistant-context.ts`:
  - Accept an optional budget input (prefer passing a `ContextBudgetManager` instance or a `{ modelId, ragBudgetTokens }` object).
  - When semantic recall is enabled:
    - retrieve chunks as today
    - treat the returned order as descending relevance unless the engine returns explicit scores (if scores become available, use them)
    - estimate per-chunk tokens
    - include chunks in relevance order until the rag budget is reached
    - if a single chunk is too large, truncate it (extractive) and mark as truncated
    - if RAG is disabled (`RAG_ENABLED=0`), return without retrieving and do not emit misleading “exceeded” increments
  - Emit `rag_budget_exceeded_total` when chunks are dropped or truncated.
  - Ensure the injected RAG wrapper text (the `<context_documents>` tags and “Use the above context…” instruction) is counted against the RAG budget, not “free”.

- Add/extend tests in `packages/api/test/assistant.context.test.ts`:
  - verify that with a tiny rag budget only the top chunk(s) are included
  - verify that `rag_budget_exceeded_total` metric increments when truncation occurs

Acceptance:

- RAG injection is capped deterministically by budget and never grows unbounded.

### Milestone 5: Observability + quality proxies + rollout controls

Goal: Make the system measurable and safe to roll out gradually.

Work:

- Add metrics:
  - `dropped_message_tiers` (can be satisfied by improving/renaming existing `historyContextTierDropsTotal` usage; ensure tiers are reported correctly, not `"unknown"`)
  - `context_quality_score` histogram:
    - Define a deterministic proxy score (0..1) based on:
      - anchors preserved
      - tool chains preserved
      - high-tier user messages retained or compressed (not dropped)
      - RAG inclusion ratio when recall enabled
      - compression severity (penalize extreme ratios)
  - Ensure these metrics are emitted from both stream and non-stream paths.

- Rollout flags:
  - `CONTEXT_COMPRESSION_ENABLED=1` toggles compression layer.
  - (Optional) `CONTEXT_TOOL_TRUNCATION_ENABLED=1` toggles tool truncation (default on if safe).
  - Ensure defaults are safe and fail-open (disable compression/truncation on unexpected errors, but never crash the request).

- “Reading the metrics” (add this as an `Artifacts and Notes` appendix once names stabilize):
  - Budget utilization (per source):
    - histogram: `context_budget_utilization{source="history"}` should cluster well below `1.0`; alerts if p95 ≥ `0.92` (compression should trigger before that) or if any p95 ≥ `1.0` (hard bug).
  - Tool truncation rate:
    - `rate(tool_result_truncated_total[5m])` should be non-zero only for tool-heavy sessions.
  - RAG budget pressure:
    - `rate(rag_budget_exceeded_total[5m])` should be non-zero when recall is enabled; investigate if it is always high (budget too small) or always zero (budget not enforced).

Acceptance:

- `/api/metrics` includes all new metrics and they change under load.
- The “contextbench” report demonstrates **30%+** prompt-token reduction between baseline and new mode on the fixture set.

## Concrete Steps

All commands below assume the repository root is `/Users/jackmazac/Development/alfred`.

1. Baseline tests (before edits):

   bun test packages/history/ packages/api/test/

2. Run the benchmark harness (baseline; flags off):

   bun run scripts/contextbench-context.ts

3. After each milestone, run targeted tests:

   bun test packages/history/test/history-context.test.ts
   bun test packages/api/test/assistant.context.test.ts

4. After completing the plan, re-run full scoped tests:

   bun test packages/history/ packages/api/test/

5. Verify metrics are present (run server and query metrics endpoint):

   bun run dev

   # In another shell:

   curl -s http://localhost:3000/api/metrics | rg "context*budget*|context*compression*|rag*budget*|tool*result_truncated|history_context*"

   Note: Adjust the port to match the local dev server if it is not 3000.

## Validation and Acceptance

### Functional acceptance (must hold)

- Unified budget tracking exists as a single `ContextBudgetManager` and is used by:
  - `packages/api/src/stream-handler.ts` (streaming)
  - `packages/api/src/ai/messages.ts` (non-stream generation path)
  - `packages/api/src/ai/assistant-context.ts` (RAG injection)
- RAG injection respects an explicit budget and drops/truncates low-relevance chunks when necessary, incrementing `rag_budget_exceeded_total`.
- Tool results > 4k tokens are truncated into a summary + AgentFS reference, and `tool_result_truncated_total` increments.
- Message compression is applied to messages older than the last 10 when history usage reaches 92% of budget, and compression ratio is recorded.
- The system is safe under these edge cases:
  - empty conversation
  - tool-heavy conversation
  - RAG disabled (`RAG_ENABLED=0` or recall opts absent)
  - Python unavailable (`ALFRED_SUMMARIZE_OFFLINE=1`)
  - a single message that exceeds the entire history budget (emergency truncation must kick in)

### Token reduction acceptance (must be demonstrated)

- The “contextbench” harness shows **≥ 30%** reduction in average prompt tokens for the fixture set when compression + tool truncation are enabled versus baseline mode.
- Context utilization remains under the safety ceiling (85%) per emitted budget metrics.

### Test acceptance (must pass)

- `bun test packages/history/ packages/api/test/` passes.
- New tests cover:
  - budget manager allocation/utilization snapshot behavior
  - compression correctness and offline fallback
  - rag budgeting behavior and metrics
  - tool truncation behavior and storage fallback

## Idempotence and Recovery

- All changes must be safe to run repeatedly.
- Feature flags must allow reverting to the previous behavior quickly:
  - `CONTEXT_COMPRESSION_ENABLED=0` disables compression.
  - Tool truncation must fail open: if AgentFS is unavailable or KV write fails, still truncate the payload and continue.
- Cache keys for compression results must be stable and bounded in memory (use an LRU or size-limited Map). Cache must not grow unbounded across requests.

## Artifacts and Notes

- Add a short “Reading context metrics” note at the bottom of this ExecPlan once metrics names stabilize, including:
  - recommended PromQL snippets for the key metrics
  - what “good” looks like (e.g., utilization < 0.85, compression ratio distributions)
- Keep benchmark outputs short; commit only fixture inputs, not large generated outputs.

## Interfaces and Dependencies

### New files (required)

- `packages/history/src/budget-manager.ts`
- `packages/history/src/compression.ts`
- `packages/history/src/tool-truncation.ts`

### Required exported interfaces (make these stable and tested)

In `packages/history/src/budget-manager.ts`, define (names are prescriptive; keep them):

- `export type ContextBudgetSource = "persona" | "preferences" | "domain" | "rag" | "history" | "tools";`
- `export interface ContextBudgetSnapshot` with:
  - `modelId: string`
  - `effectiveContextTokens: number`
  - `targetTotalTokens: number` (derived from utilization target)
  - `allocated: Record<ContextBudgetSource, number>`
  - `used: Record<ContextBudgetSource, number>`
  - `utilization: Record<ContextBudgetSource, number>` (0..1 for each source)
  - `overallUtilization: number` (0..1; prompt-only and prompt+headroom if you track both, but be explicit)
- `export class ContextBudgetManager` with methods sufficient for:
  - `estimate(text: string): number` (delegates to `createTokenEstimator`)
  - `registerSystemPart(source: "persona" | "preferences" | "domain", text: string): { text: string; tokens: number; truncated: boolean }`
  - `selectRagContext(chunks: readonly { content: string }[], opts?: { budgetTokens?: number }): { injected: string; usedTokens: number; dropped: number; truncated: number }`
    - Note: the return should be ready to append into `system` (including wrapper tags) so callers don’t duplicate wrapper-token accounting.
  - `enforceTools(tools: Record<string, import("ai").Tool>): { tools: Record<string, import("ai").Tool>; usedTokens: number; droppedToolNames: string[] }`
  - `snapshot(): ContextBudgetSnapshot`

In `packages/history/src/index.ts`, export the new modules so API can consume them:

export _ from "./budget-manager";
export _ from "./compression";
export \* from "./tool-truncation";

### Primary integration points (must be modified)

- `packages/history/src/history-context.ts`:
  - integrate compression before pruning
  - apply tool truncation to serialized parts and to returned UI messages
  - keep selection performance budget meaningful (<10ms) by splitting selection vs compression timing
- `packages/history/src/calculator.ts`:
  - keep ratios and semantics consistent; budget manager uses this as baseline
- `packages/api/src/stream-handler.ts`:
  - use `ContextBudgetManager` to coordinate system + tools + history budgeting
  - truncate tool results before persisting messages
  - integrate mid-stream enforcement via `prepareStep` composition
- `packages/api/src/ai/assistant-context.ts`:
  - accept and enforce rag budget
- `packages/api/src/ai/messages.ts`:
  - use the same budget path as streaming so behavior is consistent across surfaces
- `packages/agent/src/preference/prompt.ts`:
  - ensure preference prompt is bounded by budget (truncate or compress preferences section first)

### Performance budgets (must be enforced)

- History selection/pruning: <10ms per request (existing `withBudget(..., 10, ...)` should cover only selection work).
- Compression: <100ms per request (wrap compression separately; cache aggressively).
