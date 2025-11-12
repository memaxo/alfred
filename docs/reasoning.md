# Reasoning Memory Integration

The Codex CLI reasoning output now feeds the knowledge graph and cognitive state machine. Reasoning traces are extracted from tool responses, persisted alongside derived knowledge, and compressed by a background worker.

## Environment

- `COMPRESSION_ENABLED` toggles the background compression worker (`true` in production by default).
- `COMPRESSION_INTERVAL_MS`, `COMPRESSION_HALF_LIFE_MS`, `COMPRESSION_MIN_CONFIDENCE`, `COMPRESSION_MAX_AGE_MS` tune decay and archival behaviour.
- `REASONING_MIN_LENGTH`, `REASONING_MAX_STORED`, `REASONING_CONFIDENCE_BASE` set extraction thresholds for reasoning traces.

## Query Patterns

Use the new helpers in `@alfred/knowledge/query` to retrieve reasoning data:

- `reasoningQueries.byThread(threadId)` returns all reasoning traces tagged with a specific thread or execution id.
- `reasoningQueries.byTimeRange(startMs, endMs)` narrows traces to a temporal window.
- `reasoningQueries.byQuality(minConfidence)` filters by confidence.
- `reasoningQueries.byTopic(keywords)` performs keyword matching across traces.

`reconstructReasoningChain(nodes, edges)` accepts the reasoning nodes returned from the graph repo (ordered via their `sequenceIndex`) plus optional `precedes` edges and produces an ordered list of reasoning steps with relation metadata. This enables downstream tooling (e.g., retrospectives) to replay how a decision was reached.

## Compression Worker

`startCompressionWorker()` (triggered from `@alfred/api`) periodically:

1. Decays fact/insight confidence using an exponential half-life.
2. Archives stale, low-confidence nodes for later pruning.

Configuration merges the runtime environment with defaults from `@alfred/knowledge/compression`.

## Cognitive Loop

- `captureReasoning()` converts traces into cognitive facts with ambiguity tracking for follow-up questions.
- `evaluateReasoningQuality()` scores traces (decision points, alternatives, causal language) and feeds autonomy updates.

These helpers keep reasoning observable end-to-end—from raw tool output to long-lived knowledge and learning signals.
