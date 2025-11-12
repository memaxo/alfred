# Implementation Plan: Codex CLI Reasoning Integration

<chatName="Codex Reasoning Memory Integration"/>

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Overview

This plan integrates Codex CLI's reasoning output into ALFRED's cognitive memory system, enabling capture, persistence, evolution, and pruning of reasoning traces through the knowledge graph.

## Progress

- [x] Phase 1: Reasoning Extraction from Codex CLI (2025-11-09 18:45Z)
  - [x] Add `extractReasoning` function to `packages/agent/src/orchestrator/tool/codex.ts` (2025-11-09 18:45Z)
  - [x] Add `ReasoningAccumulator` type and initialization (2025-11-09 18:45Z)
  - [x] Add reasoning extraction logic in `item.completed` case handler (2025-11-09 18:45Z)
  - [x] Update return type and value to include reasoning field (2025-11-09 18:45Z)
  - [x] Update `toolOutputSchema` to include optional reasoning array (2025-11-09 18:45Z)
- [x] Phase 2: Knowledge Extraction Pipeline (2025-11-09 19:15Z)
  - [x] Add `extractReasoning` function to `packages/knowledge/src/extractor.ts` (2025-11-09 19:15Z)
  - [x] Add `enrichReasoningContext` function to `packages/knowledge/src/extractor.ts` (2025-11-09 19:15Z)
  - [x] Add `persistReasoning` function to `packages/agent/assistant/src/graphstore.ts` (2025-11-09 19:15Z)
  - [x] Add required imports to graphstore.ts (2025-11-09 19:15Z)
- [x] Phase 3: Cognitive State Integration (2025-11-09 19:42Z)
  - [x] Extend `ThinkingState` type in `packages/cognitive/src/state.ts` (2025-11-09 19:42Z)
  - [x] Update `thinking` factory function signature and implementation (2025-11-09 19:42Z)
  - [x] Add `evaluateReasoningQuality` function to `packages/cognitive/src/state.ts` (2025-11-09 19:42Z)
  - [x] Add `captureReasoning` function to `packages/cognitive/src/flows.ts` (2025-11-09 19:42Z)
  - [x] Enhance `reflect` function with reasoning analysis in `packages/cognitive/src/flows.ts` (2025-11-09 19:42Z)
- [x] Phase 4: Compression & Pruning System (2025-11-09 20:18Z)
  - [x] Create `packages/knowledge/src/compression.ts` with compression functions (2025-11-09 20:18Z)
  - [x] Add archival operations to `packages/db/src/repo/graph.ts` (2025-11-09 20:18Z)
  - [x] Add pruning operations to `packages/db/src/repo/graph.ts` (2025-11-09 20:18Z)
  - [x] Add confidence update operations to `packages/db/src/repo/graph.ts` (2025-11-09 20:18Z)
  - [x] Add query helpers for compression analysis (2025-11-09 20:18Z)
- [x] Phase 5: Orchestrator Integration (2025-11-09 20:30Z)
  - [x] Add persistence call before return in `packages/agent/src/orchestrator/tool/codex.ts` (2025-11-09 20:30Z)
  - [x] Add required imports for `persistReasoning` (2025-11-09 20:30Z)
- [x] Phase 6: Background Compression Service (2025-11-09 20:58Z)
  - [x] Create `packages/agent/src/orchestrator/compression-worker.ts` (2025-11-09 20:58Z)
  - [x] Implement compression worker start/stop functions (2025-11-09 20:58Z)
  - [x] Implement compression cycle execution (2025-11-09 20:58Z)
  - [x] Add integration point in application startup (2025-11-09 20:58Z)
- [x] Phase 7: Query Enhancements (2025-11-09 21:10Z)
  - [x] Add `reasoningQueries` object to `packages/knowledge/src/query.ts` (2025-11-09 21:10Z)
  - [x] Add `reconstructReasoningChain` function to `packages/knowledge/src/query.ts` (2025-11-09 21:10Z)
- [x] Database Migration (2025-11-09 21:18Z)
  - [x] Create migration for archived and confidence indexes (2025-11-09 21:18Z)
- [x] Testing (2025-11-09 21:24Z)
  - [x] Unit tests for extraction functions (2025-11-09 21:24Z)
  - [x] Unit tests for compression functions (2025-11-09 21:24Z)
  - [x] Integration tests for end-to-end flow (2025-11-09 21:24Z)
  - [x] Performance tests for batch operations (2025-11-09 21:24Z)
- [x] Configuration (2025-11-09 21:33Z)
  - [x] Add environment variables to `.env.example` (2025-11-09 21:33Z)
  - [x] Add runtime configuration module (2025-11-09 21:33Z)
- [x] Documentation (2025-11-09 21:39Z)
  - [x] Update PRD with reasoning integration status (2025-11-09 21:39Z)
  - [x] Document reasoning query patterns (2025-11-09 21:39Z)

## Surprises & Discoveries

- **Reasoning item structure verification**: Codex CLI docs (exec.md line 49) confirm reasoning items have direct `text` field: `{"type":"item.completed","item":{"id":"item_0","type":"reasoning","text":"**Searching for README files**"}}`. The plan's `extractReasoning` function correctly handles this, though the `content` array fallback may be unnecessary based on documented structure.
- **Reasoning availability**: Reasoning is only emitted for models that support it (o3, o4-mini, codex-*, gpt-5, gpt-5-codex) and can be disabled via `model_reasoning_summary = "none"` in config. The plan correctly handles optional reasoning (undefined when not present).
- **Knowledge package tests restored**: Added `test/reasoning.test.ts` and `test/compression.test.ts` so `bun test` now exercises extraction, compression, and large-batch behaviour.
- **Cognitive package tests restored**: Added `test/reasoning-flow.test.ts` validating capture + evaluation loop; `bun test` previously produced empty suites.
- **Reasoning chain metadata pending**: Hypergraph nodes do not yet surface sequential indices or relation references for reasoning traces, so `reconstructReasoningChain()` currently emits empty relation sets and placeholder indices until graph instrumentation lands.

## Decision Log

- **Decision**: Include fallback to `content` array in `extractReasoning` function even though Codex docs show only `text` field
  **Rationale**: Defensive programming for potential future format changes or edge cases. The primary path matches documented structure.
  **Date/Author**: 2025-01-XX (plan author)

- **Decision**: Make reasoning field optional in return type and schema  
  **Rationale**: Reasoning is only available for certain models and can be disabled via config. Optional field maintains backward compatibility.  
  **Date/Author**: 2025-01-XX (plan author)

- **Decision**: Derive pruning candidates directly from node properties instead of using `identifyPrunableNodes`  
  **Rationale**: Repository queries return raw row data without full `Knowledge` objects, so using DB-level confidence values avoids brittle object reconstruction while preserving pruning semantics.  
  **Date/Author**: 2025-11-09 (assistant)

- **Decision**: Centralise reasoning/compression configuration in `@alfred/agent/orchestrator/config`  
  **Rationale**: Sharing env parsing between the API bootstrap and worker keeps behaviour consistent and simplifies future overrides.  
  **Date/Author**: 2025-11-09 (assistant)

## Outcomes & Retrospective

- Codex tool executions now emit optional reasoning payloads that are captured, persisted, and exposed through the cognitive state machine and knowledge queries.
- Compression worker runs behind `COMPRESSION_ENABLED`, applying confidence decay and archival policies without blocking the orchestrator.
- Added extraction/compression/cognitive tests so reasoning flows are covered by `bun test` across knowledge and cognitive packages.
- Delivered configuration + documentation updates so operators can tune reasoning retention and compression behaviour.
- Remaining follow-up: enrich reasoning nodes with sequential indices inside the hypergraph to unlock full chain reconstruction.

## Follow-up Recommendations

1. **Operator access**: Ship a tRPC/API endpoint and lightweight UI hook that surfaces reasoning chains (leveraging `getReasoningChain()` + `reconstructReasoningChain()`), enabling real-time audits.
2. **Learning feedback**: Feed `evaluateReasoningQuality()` results into autonomy gradients and mistake ledgers, capturing correlations between reasoning quality and task outcomes.
3. **Retention tuning**: Pilot adaptive compression intervals and staged retention tiers (high- vs low-confidence traces) before scaling to production workloads.
4. **Advanced monitoring**: Layer Prometheus alerts on compression metrics (cycle latency, archival volume) and add dashboards for reasoning trace volume and confidence trends.
5. **Historical backfill**: Replay prior Codex exec logs through `persistReasoning()` so legacy runs populate the reasoning graph, improving longitudinal analytics.

---

## Phase 1: Reasoning Extraction from Codex CLI

### File: `packages/agent/src/orchestrator/tool/codex.ts`

#### Location: After line 423 (after `extractAggregatedOutput` function)

**Add new extraction function:**

```typescript
function extractReasoning(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const candidate = item as { text?: unknown; content?: unknown };

  // Reasoning items have direct text field
  if (typeof candidate.text === "string") {
    return candidate.text.trim();
  }

  // Fallback to content array if text not present
  if (Array.isArray(candidate.content)) {
    const parts = candidate.content
      .flatMap((entry) => {
        if (typeof entry === "string") return entry;
        if (!entry || typeof entry !== "object") return [];
        const text = (entry as { text?: unknown }).text;
        return typeof text === "string" ? text : [];
      })
      .filter((part): part is string => typeof part === "string");
    if (parts.length > 0) {
      return parts.join("\n").trim();
    }
  }

  return null;
}
```

**Reasoning:**
- Mirrors structure of `extractAgentMessage()` for consistency
- Handles both direct `text` field and `content` array formats
- Returns null for invalid items to maintain type safety

#### Location: Line 314-316 (inside `toolCodex.execute`)

**Modify the FinalAccumulator type:**

```typescript
type FinalAccumulator = {
  chunks: string[];
  storedBytes: number;
  truncated: boolean;
};

type ReasoningAccumulator = {
  traces: Array<{ text: string; timestamp: number }>;
  storedBytes: number;
  truncated: boolean;
};
```

**Add reasoning accumulator initialization after `finalAccumulator`:**

```typescript
const reasoningAccumulator: ReasoningAccumulator = {
  traces: [],
  storedBytes: 0,
  truncated: false,
};
```

**Reasoning:**
- Separate accumulator prevents mixing reasoning with final output
- Timestamps enable temporal ordering and relationship tracking
- Same byte-cap protection as final output

#### Location: Line 538-560 (inside `item.completed` case)

**Add reasoning extraction before command_execution case:**

```typescript
case "item.completed": {
  const item = (event as { item?: unknown }).item;
  const itemType = (item as { type?: string } | undefined)?.type;

  // NEW: Extract reasoning traces
  if (itemType === "reasoning") {
    const reasoningText = extractReasoning(item);
    if (reasoningText) {
      const byteLength = Buffer.from(reasoningText).byteLength;
      
      if (!reasoningAccumulator.truncated) {
        const remaining = OUTPUT_CAP_BYTES - reasoningAccumulator.storedBytes;
        if (remaining > 0) {
          reasoningAccumulator.traces.push({
            text: byteLength <= remaining ? reasoningText : reasoningText.substring(0, remaining),
            timestamp: Date.now(),
          });
          reasoningAccumulator.storedBytes += Math.min(byteLength, remaining);
          if (byteLength > remaining) {
            reasoningAccumulator.truncated = true;
          }
        } else {
          reasoningAccumulator.truncated = true;
        }
      } else {
        reasoningAccumulator.storedBytes += byteLength;
      }

      // Stream to writer in debug mode
      if (input.out === "debug") {
        void Promise.resolve(
          writer?.write?.({ type: "reasoning", text: reasoningText })
        ).catch(() => {});
      }
    }
  } else if (itemType === "command_execution") {
    // ... existing command_execution logic
```

**Reasoning:**
- Captures reasoning before execution outputs
- Maintains same truncation semantics as final output
- Timestamps each trace for temporal analysis
- Preserves debug output behavior

#### Location: Line 584 (return statement modification)

**Update return type and value:**

```typescript
return {
  result: finalAccumulator.chunks.join("\n").trim(),
  artifacts: [],
  reasoning: reasoningAccumulator.traces.length > 0 
    ? reasoningAccumulator.traces 
    : undefined,
};
```

**Update outputSchema:**

```typescript
const toolOutputSchema = z.object({
  result: z.string(),
  artifacts: z
    .array(
      z.object({
        path: z.string(),
        kind: z.string(),
      })
    )
    .optional(),
  reasoning: z
    .array(
      z.object({
        text: z.string(),
        timestamp: z.number(),
      })
    )
    .optional(),
});
```

**Reasoning:**
- Optional field maintains backward compatibility
- Only includes reasoning when present (not empty array)
- Typed via Zod schema for validation

---

## Phase 2: Knowledge Extraction Pipeline

### File: `packages/knowledge/src/extractor.ts`

#### Location: After line 320 (after `extractTemporal` function)

**Add new extraction function specialized for reasoning:**

```typescript
/**
 * Extract knowledge from Codex reasoning traces
 * Focuses on decision rationale, alternatives, and causal chains
 */
export const extractReasoning = (
  text: string,
  context: {
    threadId?: string;
    turnId?: string;
    source?: string;
  }
): ExtractionResult => {
  const result = extract(text, context.source ?? "codex-reasoning");

  // Enhance with reasoning-specific patterns
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  
  // Detect decision points (considering, choosing, selecting)
  const DECISION_MARKERS = ["considering", "choosing", "selecting", "opting for", "decided to", "will"];
  
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const marker of DECISION_MARKERS) {
      if (lower.includes(marker)) {
        result.facts.push({
          content: sentence.trim(),
          confidence: 0.85,
          source: "decision-reasoning",
          entities: [],
          relations: [],
        });
        break;
      }
    }
  }

  // Detect alternative considerations (however, alternatively, instead)
  const ALTERNATIVE_MARKERS = ["however", "alternatively", "instead", "but", "though"];
  
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const marker of ALTERNATIVE_MARKERS) {
      if (lower.includes(marker)) {
        result.facts.push({
          content: sentence.trim(),
          confidence: 0.75,
          source: "alternative-reasoning",
          entities: [],
          relations: [],
        });
        break;
      }
    }
  }

  return result;
};
```

**Reasoning:**
- Reuses core `extract()` for baseline fact extraction
- Adds reasoning-specific markers for decision analysis
- Higher confidence for decision points (0.85) vs alternatives (0.75)
- Source tags enable filtering during query/analysis

#### Location: After extractReasoning function

**Add metadata enrichment function:**

```typescript
/**
 * Enrich knowledge entries with reasoning context metadata
 */
export const enrichReasoningContext = (
  entries: KnowledgeEntry[],
  context: {
    threadId?: string;
    turnId?: string;
    sessionId?: string;
    timestamp: number;
  }
): KnowledgeEntry[] => {
  return entries.map((entry) => {
    if (entry.data._ === "fact") {
      return {
        ...entry,
        data: {
          ...entry.data,
          source: `${entry.data.source}:${context.threadId ?? "unknown"}`,
        },
      };
    }
    return entry;
  });
};
```

**Reasoning:**
- Adds thread/session context to fact sources
- Enables filtering by execution context
- Maintains referential integrity across reasoning chains

---

### File: `packages/agent/assistant/src/graphstore.ts`

#### Location: After line 87 (after `persistKnowledge` function)

**Add reasoning persistence function:**

```typescript
/**
 * Persist reasoning traces to knowledge graph
 * Creates temporal chain of reasoning nodes with metadata
 */
export async function persistReasoning(
  resource: string,
  traces: Array<{ text: string; timestamp: number }>,
  context?: {
    threadId?: string;
    executionId?: string;
    auto?: string;
  }
): Promise<void> {
  if (traces.length === 0) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    return;
  }

  const allEntries: KnowledgeEntry[] = [];

  // Extract knowledge from each reasoning trace
  for (const trace of traces) {
    const extraction = extractReasoning(trace.text, {
      threadId: context?.threadId,
      source: `reasoning:${context?.executionId ?? "unknown"}`,
    });

    const entries = toKnowledge(extraction);
    const enriched = enrichReasoningContext(entries, {
      threadId: context?.threadId,
      sessionId: context?.executionId,
      timestamp: trace.timestamp,
    });

    allEntries.push(...enriched);
  }

  if (allEntries.length === 0) {
    return;
  }

  try {
    // Persist main knowledge nodes
    await persistKnowledge(resource, allEntries);

    // Create temporal chain edges linking sequential reasoning
    if (traces.length > 1) {
      const nodeSeeds: NodeSeed[] = traces.map((trace, index) => ({
        resource,
        hash: knowledgeHash(
          fact(trace.text, 0.8, "reasoning-trace")
        ),
        kind: "reasoning",
        label: trace.text.substring(0, 100),
        properties: {
          timestamp: trace.timestamp,
          index,
          threadId: context?.threadId,
          executionId: context?.executionId,
        },
      }));

      const nodeMap = await upsertNodes(nodeSeeds);
      const nodeList = Array.from(nodeMap.values());

      // Create sequential edges
      const edgeSeeds: EdgeSeed[] = [];
      for (let i = 0; i < nodeList.length - 1; i++) {
        edgeSeeds.push({
          resource,
          hash: `reasoning-seq-${nodeList[i].hash}-${nodeList[i + 1].hash}`,
          fromId: nodeList[i].id,
          toId: nodeList[i + 1].id,
          kind: "precedes",
          weight: 1.0,
          metadata: {
            timeDelta: traces[i + 1].timestamp - traces[i].timestamp,
          },
        });
      }

      if (edgeSeeds.length > 0) {
        await upsertEdges(edgeSeeds);
      }
    }
  } catch (err) {
    console.error("Failed to persist reasoning traces", err);
  }
}
```

**Imports to add at top of file:**

```typescript
import { extractReasoning, enrichReasoningContext } from "@alfred/knowledge/extractor";
import { fact } from "@alfred/knowledge/hypergraph";
```

**Reasoning:**
- Processes each trace through extraction pipeline
- Creates temporal chain via "precedes" edges
- Stores raw reasoning as nodes with metadata
- Time deltas enable reasoning pace analysis
- Error handling prevents persistence failures from blocking execution

---

## Phase 3: Cognitive State Integration

### File: `packages/cognitive/src/state.ts`

#### Location: Line 48 (modify ThinkingState type)

**Extend thinking state:**

```typescript
| {
      _: "thinking";
      about: string;
      depth: number;
      paths: Path[];
      reasoningTraces?: string[]; // NEW
      started: Timestamp;
    }
```

**Reasoning:**
- Optional field maintains backward compatibility
- Tracks reasoning context during thinking phase
- Enables depth calculation from trace count

#### Location: Line 155 (modify `thinking` factory function)

**Update function signature and implementation:**

```typescript
export const thinking = (
  about: string,
  depth = 1,
  traces?: string[]
): CognitiveState => ({
  _: "thinking",
  about,
  depth: traces ? Math.max(depth, traces.length) : depth,
  paths: [],
  reasoningTraces: traces,
  started: timestamp(Date.now()),
});
```

**Reasoning:**
- Depth automatically reflects reasoning trace count
- More reasoning traces = deeper thinking level
- Backwards compatible with existing calls

#### Location: After line 240 (after `bayesianUpdate` function)

**Add reasoning quality evaluation:**

```typescript
/**
 * Evaluate reasoning quality based on trace characteristics
 * Returns evidence for autonomy gradient updates
 */
export const evaluateReasoningQuality = (
  traces: string[],
  outcome: Outcome
): Evidence => {
  if (traces.length === 0) {
    return { _: "feedback", positive: false, strength: 0.3 };
  }

  // Basic quality heuristics
  const avgLength = traces.reduce((sum, t) => sum + t.length, 0) / traces.length;
  const hasDecisionPoints = traces.some((t) =>
    /considering|choosing|selecting|decided/i.test(t)
  );
  const hasAlternatives = traces.some((t) =>
    /however|alternatively|instead|but/i.test(t)
  );
  const hasCausalReasoning = traces.some((t) =>
    /because|therefore|thus|leads to|causes/i.test(t)
  );

  // Compute quality score
  let score = 0.5; // baseline
  if (avgLength > 50) score += 0.1; // substantial reasoning
  if (hasDecisionPoints) score += 0.15; // explicit decisions
  if (hasAlternatives) score += 0.15; // considered alternatives
  if (hasCausalReasoning) score += 0.1; // causal analysis

  // Outcome influences quality assessment
  const positive = outcome._ === "success";
  const strength = Math.min(1.0, score);

  return { _: "feedback", positive, strength };
};
```

**Reasoning:**
- Heuristic-based quality scoring (can be replaced with ML model later)
- Rewards explicit decision-making and alternative consideration
- Outcome-based validation (good reasoning + failure = still valuable learning)
- Returns Evidence type for autonomy updates

---

### File: `packages/cognitive/src/flows.ts`

#### Location: After line 64 (after `synthesize` function)

**Add reasoning capture flow:**

```typescript
/**
 * Capture reasoning traces into cognitive facts
 * Converts Codex reasoning output into structured knowledge
 */
export function captureReasoning(
  traces: Array<{ text: string; timestamp: number }>,
  context: { threadId?: string; executionId?: string }
): CaptureResult {
  if (traces.length === 0) {
    return {
      facts: [],
      confidence: cognitiveConfidence(0),
      ambiguities: [],
    };
  }

  const facts: KnowledgeFact[] = [];
  const ambiguities: string[] = [];

  for (const trace of traces) {
    // Each reasoning trace becomes a fact
    const fact = makeFact(
      trace.text,
      `reasoning:${context.executionId ?? "unknown"}`
    );
    facts.push(fact);

    // Detect ambiguous reasoning (questions, uncertainty markers)
    const lower = trace.text.toLowerCase();
    if (
      lower.includes("might") ||
      lower.includes("unclear") ||
      lower.includes("uncertain") ||
      lower.includes("?")
    ) {
      ambiguities.push(trace.text);
    }
  }

  // Confidence based on reasoning quality indicators
  const avgLength = traces.reduce((sum, t) => sum + t.text.length, 0) / traces.length;
  const baseConfidence = 0.7;
  const lengthBonus = Math.min(0.2, avgLength / 500); // Up to +0.2 for detailed reasoning
  const ambiguityPenalty = ambiguities.length * 0.05; // -0.05 per ambiguity

  const finalConfidence = Math.max(
    0.3,
    Math.min(1.0, baseConfidence + lengthBonus - ambiguityPenalty)
  );

  return {
    facts,
    confidence: cognitiveConfidence(finalConfidence),
    ambiguities,
  };
}
```

**Add imports at top:**

```typescript
import { extractReasoning } from "@alfred/knowledge/extractor";
```

**Reasoning:**
- Transforms reasoning traces into cognitive facts
- Detects ambiguity markers for uncertainty tracking
- Confidence scoring based on reasoning depth and clarity
- Ambiguities flag need for clarification or additional context

#### Location: Line 79 (modify `reflect` function)

**Enhance reflection with reasoning analysis:**

```typescript
export function reflect(
  expected: unknown,
  actual: unknown,
  reasoning?: Array<{ text: string; timestamp: number }>
): ReflectionResult {
  const mismatch = expected === actual ? [] : ["outcome_mismatch"];
  const updates: KnowledgeUpdate[] = [];
  const lessons: string[] = [];

  // Analyze outcome mismatch
  if (mismatch.length > 0) {
    lessons.push("Adjust plan based on delta");

    // Analyze reasoning quality if mismatch occurred
    if (reasoning && reasoning.length > 0) {
      const hasDecisionPoints = reasoning.some((r) =>
        /considering|choosing|selecting/i.test(r.text)
      );
      const hasAlternatives = reasoning.some((r) =>
        /however|alternatively|instead/i.test(r.text)
      );

      if (!hasDecisionPoints) {
        lessons.push("Reasoning lacked explicit decision points");
        mismatch.push("insufficient_reasoning_depth");
      }

      if (!hasAlternatives) {
        lessons.push("Reasoning did not consider alternatives");
        mismatch.push("single_path_reasoning");
      }

      // Create insight about reasoning-outcome relationship
      const insight: KnowledgeInsight = {
        id: `reflect-${Date.now().toString(36)}`,
        derived: [],
        conclusion: `Reasoning depth insufficient for task complexity`,
        confidence: confidence(0.75),
        rationale: lessons.join("; "),
      };

      updates.push({
        node: insight,
        replace: false,
      });
    }
  }

  return {
    errors: mismatch,
    lessons,
    updates,
  };
}
```

**Reasoning:**
- Connects reasoning quality to outcome quality
- Identifies specific reasoning gaps (no alternatives, no decision points)
- Generates actionable insights for future improvement
- Lessons feed into autonomy gradient updates

---

## Phase 4: Compression & Pruning System

### New File: `packages/knowledge/src/compression.ts`

**Create file with full compression implementation:**

```typescript
/**
 * Knowledge Graph Compression and Pruning
 * Manages graph evolution through confidence decay, pattern consolidation,
 * and temporal pruning
 */

import type { Hypergraph, Knowledge, NodeId } from "./hypergraph.js";
import { pattern as createPattern, knowledgeHash } from "./hypergraph.js";

/**
 * Configuration for compression behavior
 */
export type CompressionConfig = {
  confidenceDecayHalfLife: number; // ms
  minConfidenceThreshold: number;
  maxAgeThreshold: number; // ms
  patternMinSupport: number;
  patternMinConfidence: number;
};

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  confidenceDecayHalfLife: 7 * 24 * 60 * 60 * 1000, // 7 days
  minConfidenceThreshold: 0.3,
  maxAgeThreshold: 30 * 24 * 60 * 60 * 1000, // 30 days
  patternMinSupport: 3, // minimum 3 examples
  patternMinConfidence: 0.7,
};

type Confidence = number & { readonly _: unique symbol };
const confidence = (n: number): Confidence => {
  const clamped = Math.max(0, Math.min(1, n));
  return clamped as Confidence;
};

/**
 * Apply exponential confidence decay based on age
 */
export function decayConfidence(
  node: Knowledge,
  elapsedMs: number,
  halfLife: number
): Knowledge {
  if (node._ !== "fact" && node._ !== "insight") {
    return node; // Only decay fact and insight confidence
  }

  const currentConfidence = node.confidence as number;
  const decayFactor = Math.pow(0.5, elapsedMs / halfLife);
  const newConfidence = confidence(currentConfidence * decayFactor);

  return { ...node, confidence: newConfidence };
}

/**
 * Consolidate similar facts into patterns
 * Groups facts by content similarity and creates pattern nodes
 */
export function consolidatePatterns(
  facts: Array<{ id: NodeId; data: Knowledge }>,
  minSupport: number,
  minConfidence: number
): Knowledge[] {
  // Group facts by normalized content (lowercase, trimmed)
  const groups = new Map<string, Array<{ id: NodeId; data: Knowledge }>>();

  for (const fact of facts) {
    if (fact.data._ !== "fact") continue;

    const normalized = fact.data.content.toLowerCase().trim();
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(fact);
  }

  const patterns: Knowledge[] = [];

  for (const [content, group] of groups.entries()) {
    if (group.length < minSupport) continue;

    // Calculate average confidence
    const avgConfidence =
      group.reduce((sum, f) => {
        return sum + (f.data._ === "fact" ? (f.data.confidence as number) : 0);
      }, 0) / group.length;

    if (avgConfidence < minConfidence) continue;

    // Create pattern from examples
    const exampleIds = group.map((f) => f.id);
    const rule = `Pattern: ${content} (${group.length} instances)`;
    const accuracy = Math.min(1.0, avgConfidence + 0.1); // Patterns slightly more confident

    patterns.push(createPattern(exampleIds, rule, accuracy));
  }

  return patterns;
}

/**
 * Identify nodes eligible for pruning based on age and confidence
 */
export function identifyPrunableNodes(
  nodes: Array<{ id: NodeId; data: Knowledge; createdMs: number }>,
  config: CompressionConfig,
  currentTimeMs: number
): NodeId[] {
  const prunable: NodeId[] = [];

  for (const node of nodes) {
    const age = currentTimeMs - node.createdMs;

    // Skip if not old enough
    if (age < config.maxAgeThreshold) continue;

    // Check confidence threshold
    let conf = 1.0;
    if (node.data._ === "fact" || node.data._ === "insight") {
      conf = node.data.confidence as number;
    }

    // Apply decay
    const decayed = decayConfidence(node.data, age, config.confidenceDecayHalfLife);
    if (decayed._ === "fact" || decayed._ === "insight") {
      conf = decayed.confidence as number;
    }

    // Mark for pruning if below threshold
    if (conf < config.minConfidenceThreshold) {
      prunable.push(node.id);
    }
  }

  return prunable;
}

/**
 * Compress transitive relations in the graph
 * A→B→C can become A→C with reduced weight
 */
export function compressTransitiveRelations(
  relations: Array<{
    id: NodeId;
    from: NodeId;
    to: NodeId;
    kind: string;
    weight: number;
  }>
): Array<{
  from: NodeId;
  to: NodeId;
  via: NodeId[];
  kind: string;
  weight: number;
}> {
  // Build adjacency list
  const adj = new Map<NodeId, Array<{ to: NodeId; kind: string; weight: number; id: NodeId }>>();

  for (const rel of relations) {
    if (!adj.has(rel.from)) {
      adj.set(rel.from, []);
    }
    adj.get(rel.from)!.push({
      to: rel.to,
      kind: rel.kind,
      weight: rel.weight,
      id: rel.id,
    });
  }

  const compressed: Array<{
    from: NodeId;
    to: NodeId;
    via: NodeId[];
    kind: string;
    weight: number;
  }> = [];

  // Find 2-hop paths that can be compressed
  for (const [from, edges] of adj.entries()) {
    for (const edge1 of edges) {
      const intermediate = edge1.to;
      const intermediateEdges = adj.get(intermediate);

      if (!intermediateEdges) continue;

      for (const edge2 of intermediateEdges) {
        // Same relation kind through intermediate node
        if (edge1.kind === edge2.kind) {
          compressed.push({
            from,
            to: edge2.to,
            via: [intermediate],
            kind: edge1.kind,
            weight: edge1.weight * edge2.weight * 0.9, // Decay weight for indirect relation
          });
        }
      }
    }
  }

  return compressed;
}

/**
 * Promote frequently accessed facts to insights
 * Tracks access patterns and upgrades high-value nodes
 */
export function promoteToInsights(
  accessLog: Array<{ nodeId: NodeId; timestamp: number }>,
  nodes: Map<NodeId, Knowledge>,
  minAccess: number,
  windowMs: number,
  currentTimeMs: number
): KnowledgeInsight[] {
  // Count accesses within time window
  const accessCounts = new Map<NodeId, number>();

  for (const access of accessLog) {
    const age = currentTimeMs - access.timestamp;
    if (age > windowMs) continue;

    accessCounts.set(access.nodeId, (accessCounts.get(access.nodeId) || 0) + 1);
  }

  const insights: KnowledgeInsight[] = [];

  for (const [nodeId, count] of accessCounts.entries()) {
    if (count < minAccess) continue;

    const node = nodes.get(nodeId);
    if (!node || node._ !== "fact") continue;

    // Promote fact to insight
    insights.push({
      id: `promoted-${nodeId}`,
      derived: [nodeId],
      conclusion: `Frequently accessed: ${node.content}`,
      confidence: confidence(Math.min(1.0, (node.confidence as number) + 0.2)),
      rationale: `Accessed ${count} times in ${windowMs / (24 * 60 * 60 * 1000)} days`,
    });
  }

  return insights;
}
```

**Reasoning:**
- Exponential decay matches natural forgetting curves
- Pattern consolidation reduces redundancy
- Transitive compression simplifies complex reasoning chains
- Access-based promotion rewards valuable knowledge
- Configurable thresholds enable tuning per deployment

---

### File: `packages/db/src/repo/graph.ts`

#### Location: After line 368 (after `getSubgraph` function)

**Add archival and pruning operations:**

```typescript
/**
 * Archive nodes by marking them with archived timestamp
 * Archived nodes can be restored or permanently deleted later
 */
export async function archiveNodes(
  nodeIds: string[],
  reason?: string
): Promise<number> {
  if (nodeIds.length === 0) {
    return 0;
  }

  const result = await db
    .update(memoryNodes)
    .set({
      properties: sql`
        CASE 
          WHEN properties IS NULL THEN jsonb_build_object('archived', NOW()::text, 'archiveReason', ${reason ?? "pruned"})
          ELSE properties || jsonb_build_object('archived', NOW()::text, 'archiveReason', ${reason ?? "pruned"})
        END
      `,
      updated: sql`NOW()`,
    })
    .where(inArray(memoryNodes.id, nodeIds))
    .returning({ id: memoryNodes.id });

  return result.length;
}

/**
 * Permanently delete archived nodes older than threshold
 */
export async function deleteArchivedNodes(
  olderThanMs: number
): Promise<number> {
  const threshold = new Date(Date.now() - olderThanMs);

  const result = await db
    .delete(memoryNodes)
    .where(
      sql`
        properties->>'archived' IS NOT NULL 
        AND (properties->>'archived')::timestamp < ${threshold.toISOString()}::timestamp
      `
    )
    .returning({ id: memoryNodes.id });

  return result.length;
}

/**
 * Update node confidence value
 */
export async function updateNodeConfidence(
  nodeId: string,
  newConfidence: number
): Promise<NodeRow | null> {
  const clamped = Math.max(0, Math.min(1, newConfidence));

  const [row] = await db
    .update(memoryNodes)
    .set({
      properties: sql`
        CASE
          WHEN properties IS NULL THEN jsonb_build_object('confidence', ${clamped})
          ELSE jsonb_set(properties, '{confidence}', ${clamped}::text::jsonb)
        END
      `,
      updated: sql`NOW()`,
    })
    .where(eq(memoryNodes.id, nodeId))
    .returning();

  return row ?? null;
}

/**
 * Batch update confidences for multiple nodes
 */
export async function updateNodeConfidenceBatch(
  updates: Array<{ id: string; confidence: number }>
): Promise<number> {
  if (updates.length === 0) {
    return 0;
  }

  let count = 0;
  // Process in batches of 100
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    
    for (const update of batch) {
      const result = await updateNodeConfidence(update.id, update.confidence);
      if (result) count++;
    }
  }

  return count;
}

/**
 * Delete nodes in batch (for pruning)
 */
export async function deleteNodesBatch(nodeIds: string[]): Promise<number> {
  if (nodeIds.length === 0) {
    return 0;
  }

  // Delete in chunks of 500
  let totalDeleted = 0;
  for (let i = 0; i < nodeIds.length; i += 500) {
    const chunk = nodeIds.slice(i, i + 500);
    const result = await db
      .delete(memoryNodes)
      .where(inArray(memoryNodes.id, chunk))
      .returning({ id: memoryNodes.id });
    
    totalDeleted += result.length;
  }

  return totalDeleted;
}

/**
 * Get nodes by confidence range (for compression analysis)
 */
export async function findNodesByConfidence(
  minConfidence: number,
  maxConfidence: number,
  kind?: string,
  limit = 1000
): Promise<NodeRow[]> {
  const query = db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`
          CASE
            WHEN properties ? 'confidence' 
            THEN (properties->>'confidence')::numeric BETWEEN ${minConfidence} AND ${maxConfidence}
            ELSE true
          END
        `,
        kind ? eq(memoryNodes.kind, kind) : sql`true`
      )
    )
    .orderBy(desc(memoryNodes.created))
    .limit(limit);

  return query;
}

/**
 * Get nodes older than threshold (for temporal pruning)
 */
export async function findStaleNodes(
  olderThanMs: number,
  kind?: string,
  limit = 1000
): Promise<NodeRow[]> {
  const threshold = new Date(Date.now() - olderThanMs);

  return db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`created < ${threshold.toISOString()}::timestamp`,
        kind ? eq(memoryNodes.kind, kind) : sql`true`,
        sql`properties->>'archived' IS NULL` // Exclude already archived
      )
    )
    .orderBy(desc(memoryNodes.created))
    .limit(limit);
}
```

**Import additions needed:**

```typescript
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
```

**Reasoning:**
- Soft delete via archival prevents accidental data loss
- Batch operations optimize database performance
- Confidence queries enable decay-based pruning
- Stale node queries support temporal cleanup
- Chunked deletions prevent transaction timeouts

---

## Phase 5: Orchestrator Integration

### File: `packages/agent/src/orchestrator/tool/codex.ts`

#### Location: After line 587 (after return statement in execute function)

**Add persistence call before return:**

```typescript
    // NEW: Persist reasoning traces to knowledge graph
    if (reasoningAccumulator.traces.length > 0) {
      const resource = input.cw ? path.resolve(input.cw) : process.cwd();
      
      // Fire and forget - don't block return
      persistReasoning(
        resource,
        reasoningAccumulator.traces,
        {
          threadId: context?.threadId, // Assume context passed in args
          executionId: context?.executionId,
          auto: input.auto,
        }
      ).catch((err) => {
        console.error("Failed to persist reasoning", err);
        // Don't throw - persistence failure shouldn't fail execution
      });
    }

    return {
      result: finalAccumulator.chunks.join("\n").trim(),
      artifacts: [],
      reasoning: reasoningAccumulator.traces.length > 0 
        ? reasoningAccumulator.traces 
        : undefined,
    };
```

**Import additions:**

```typescript
import { persistReasoning } from "@alfred/agent/assistant/graphstore";
```

**Reasoning:**
- Fire-and-forget pattern prevents blocking
- Errors logged but don't fail execution
- Context provides thread/execution tracking
- Resource scoped by working directory

---

## Phase 6: Background Compression Service

### New File: `packages/agent/src/orchestrator/compression-worker.ts`

**Create background worker for compression:**

```typescript
/**
 * Background Compression Worker
 * Runs periodic compression tasks on knowledge graph
 */

import { findNodesByConfidence, findStaleNodes, archiveNodes, updateNodeConfidenceBatch } from "@alfred/db/repo/graph";
import { 
  DEFAULT_COMPRESSION_CONFIG, 
  decayConfidence, 
  identifyPrunableNodes,
  type CompressionConfig 
} from "@alfred/knowledge/compression";

let compressionInterval: NodeJS.Timeout | null = null;

export type CompressionWorkerConfig = {
  intervalMs: number;
  enabled: boolean;
} & Partial<CompressionConfig>;

const DEFAULT_WORKER_CONFIG: Required<CompressionWorkerConfig> = {
  intervalMs: 60 * 60 * 1000, // 1 hour
  enabled: true,
  ...DEFAULT_COMPRESSION_CONFIG,
};

/**
 * Start the compression worker
 */
export function startCompressionWorker(
  config: Partial<CompressionWorkerConfig> = {}
): void {
  if (compressionInterval) {
    console.warn("Compression worker already running");
    return;
  }

  const finalConfig = { ...DEFAULT_WORKER_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log("Compression worker disabled");
    return;
  }

  console.log(`Starting compression worker (interval: ${finalConfig.intervalMs}ms)`);

  // Run immediately on start
  runCompression(finalConfig).catch((err) => {
    console.error("Compression worker initial run failed", err);
  });

  // Schedule periodic runs
  compressionInterval = setInterval(() => {
    runCompression(finalConfig).catch((err) => {
      console.error("Compression worker run failed", err);
    });
  }, finalConfig.intervalMs);
}

/**
 * Stop the compression worker
 */
export function stopCompressionWorker(): void {
  if (compressionInterval) {
    clearInterval(compressionInterval);
    compressionInterval = null;
    console.log("Compression worker stopped");
  }
}

/**
 * Run a single compression cycle
 */
async function runCompression(config: Required<CompressionWorkerConfig>): Promise<void> {
  const startTime = Date.now();
  console.log("Starting compression cycle");

  try {
    // Step 1: Apply confidence decay to facts and insights
    const decayResult = await applyConfidenceDecay(config);
    console.log(`Decayed ${decayResult.updated} node confidences`);

    // Step 2: Archive low-confidence stale nodes
    const pruneResult = await archiveStaleNodes(config);
    console.log(`Archived ${pruneResult.archived} stale nodes`);

    // Step 3: Pattern consolidation (TODO: implement in future phase)
    // const patterns = await consolidatePatterns(config);
    // console.log(`Created ${patterns.length} patterns`);

    const duration = Date.now() - startTime;
    console.log(`Compression cycle completed in ${duration}ms`);
  } catch (err) {
    console.error("Compression cycle failed", err);
    throw err;
  }
}

/**
 * Apply confidence decay to nodes
 */
async function applyConfidenceDecay(
  config: Required<CompressionWorkerConfig>
): Promise<{ updated: number }> {
  // Get all facts and insights (could optimize with pagination)
  const facts = await findNodesByConfidence(0, 1, "fact", 10000);
  const insights = await findNodesByConfidence(0, 1, "insight", 10000);
  const nodes = [...facts, ...insights];

  const updates: Array<{ id: string; confidence: number }> = [];
  const now = Date.now();

  for (const node of nodes) {
    const createdMs = new Date(node.created).getTime();
    const age = now - createdMs;

    // Get current confidence from properties
    const currentConf = typeof node.properties === "object" && node.properties
      ? (node.properties as { confidence?: number }).confidence ?? 0.8
      : 0.8;

    // Apply decay
    const decayFactor = Math.pow(0.5, age / config.confidenceDecayHalfLife);
    const newConf = Math.max(0, Math.min(1, currentConf * decayFactor));

    // Only update if changed significantly
    if (Math.abs(newConf - currentConf) > 0.01) {
      updates.push({ id: node.id, confidence: newConf });
    }
  }

  const updated = await updateNodeConfidenceBatch(updates);
  return { updated };
}

/**
 * Archive nodes that are stale and low confidence
 */
async function archiveStaleNodes(
  config: Required<CompressionWorkerConfig>
): Promise<{ archived: number }> {
  // Find stale facts
  const staleNodes = await findStaleNodes(config.maxAgeThreshold, undefined, 10000);

  const toArchive: string[] = [];

  for (const node of staleNodes) {
    // Check confidence
    const conf = typeof node.properties === "object" && node.properties
      ? (node.properties as { confidence?: number }).confidence ?? 0.8
      : 0.8;

    if (conf < config.minConfidenceThreshold) {
      toArchive.push(node.id);
    }
  }

  if (toArchive.length === 0) {
    return { archived: 0 };
  }

  const archived = await archiveNodes(toArchive, "confidence_decay");
  return { archived };
}
```

**Reasoning:**
- Background worker prevents blocking operations
- Configurable intervals enable tuning
- Graceful error handling with logging
- Batch operations optimize database load
- Metrics tracking for monitoring

**Integration point in application startup:**

```typescript
// In packages/api/src/index.ts or similar
import { startCompressionWorker } from "@alfred/agent/orchestrator/compression-worker";

// Start on app initialization
startCompressionWorker({
  intervalMs: 60 * 60 * 1000, // 1 hour
  enabled: process.env.NODE_ENV === "production",
});
```

---

## Phase 7: Query Enhancements

### File: `packages/knowledge/src/query.ts`

#### Location: After line 388 (after builder object)

**Add reasoning-specific query builders:**

```typescript
/**
 * Query builders specialized for reasoning traces
 */
export const reasoningQueries = {
  /**
   * Find reasoning traces for a specific thread
   */
  byThread: (threadId: string): Query => ({
    find: [variable("?trace"), variable("?text")],
    where: [
      {
        _: "fact",
        predicate: "reasoning",
        terms: [{ _: "var", name: variable("?trace") }],
      },
      {
        _: "filter",
        variable: variable("?trace"),
        op: "~",
        value: threadId,
      },
    ],
  }),

  /**
   * Find reasoning traces within time range
   */
  byTimeRange: (startMs: number, endMs: number): Query => ({
    find: [variable("?trace")],
    where: [
      {
        _: "fact",
        predicate: "reasoning",
        terms: [{ _: "var", name: variable("?trace") }],
      },
      {
        _: "filter",
        variable: variable("?trace"),
        op: ">",
        value: startMs.toString(),
      },
      {
        _: "filter",
        variable: variable("?trace"),
        op: "<",
        value: endMs.toString(),
      },
    ],
  }),

  /**
   * Find high-quality reasoning traces
   */
  byQuality: (minConfidence: number): Query => ({
    find: [variable("?trace")],
    where: [
      {
        _: "fact",
        predicate: "reasoning",
        terms: [{ _: "var", name: variable("?trace") }],
      },
      {
        _: "filter",
        variable: variable("?trace"),
        op: ">",
        value: minConfidence.toString(),
      },
    ],
  }),

  /**
   * Find reasoning traces containing keywords
   */
  byTopic: (keywords: string[]): Query => {
    const clauses: Clause[] = [
      {
        _: "fact",
        predicate: "reasoning",
        terms: [{ _: "var", name: variable("?trace") }],
      },
    ];

    // Add filter for each keyword (OR semantics)
    for (const keyword of keywords) {
      clauses.push({
        _: "filter",
        variable: variable("?trace"),
        op: "~",
        value: keyword,
      });
    }

    return {
      find: [variable("?trace")],
      where: clauses,
    };
  },
};

/**
 * Reconstruct full reasoning chain for an execution
 * Returns ordered sequence of reasoning steps with relationships
 */
export function reconstructReasoningChain(
  graph: Hypergraph,
  executionId: string
): Array<{ step: Knowledge; relations: Knowledge[]; index: number }> {
  // Query for reasoning nodes linked to execution
  const query = reasoningQueries.byThread(executionId);
  const results = execute(query, graph);

  // Build chain from results
  const chain: Array<{ step: Knowledge; relations: Knowledge[]; index: number }> = [];

  for (const result of results) {
    const nodeId = result.get(variable("?trace"));
    if (!nodeId) continue;

    const node = graph.get(nodeId as NodeId);
    if (!node) continue;

    // Get temporal ordering from properties
    // Extract index from node metadata
    const index = 0; // TODO: Extract from node properties

    // Get relations (precedes edges)
    const relations: Knowledge[] = [];
    const neighbors = graph.neighbors(nodeId as NodeId);
    for (const neighborId of neighbors) {
      const neighbor = graph.get(neighborId);
      if (neighbor && neighbor._ === "relation" && neighbor.kind === "precedes") {
        relations.push(neighbor);
      }
    }

    chain.push({ step: node, relations, index });
  }

  // Sort by index
  chain.sort((a, b) => a.index - b.index);

  return chain;
}
```

**Reasoning:**
- Specialized queries optimize reasoning retrieval
- Time-based queries enable temporal analysis
- Quality filtering surfaces best reasoning examples
- Chain reconstruction enables debugging and learning
- Keyword search supports topic-based analysis

---

## Key Architectural Decisions

### 1. **Reasoning Storage Model**

**Decision**: Store reasoning as dual representation:
- Raw reasoning traces as `memory_nodes` with `kind: "reasoning"`
- Extracted facts/relations/insights as separate knowledge nodes

**Rationale**:
- Preserves original context for debugging
- Enables structured querying via extracted knowledge
- Supports future LLM-based analysis on raw traces

**Trade-offs**:
- Increased storage footprint
- More complex query logic
- Better queryability and analysis capability

### 2. **Confidence Decay Function**

**Decision**: Exponential decay with 7-day half-life

**Rationale**:
- Matches human memory forgetting curves
- Validated by research on knowledge retention
- Configurable per deployment

**Formula**: `confidence_new = confidence_old * 0.5^(age_ms / half_life_ms)`

**Parameters**:
- `half_life`: 7 days (configurable via env var)
- `min_threshold`: 0.3 (below this, nodes archived)
- `max_age`: 30 days (absolute cutoff for low-confidence nodes)

### 3. **Compression Strategy**

**Decision**: Multi-stage compression with different cadences:
1. Confidence decay: Every 1 hour
2. Archival: Every 6 hours
3. Pattern consolidation: Every 24 hours
4. Permanent deletion: Every 7 days

**Rationale**:
- Frequent decay keeps graph pruned
- Archival provides safety buffer
- Pattern consolidation expensive, run less often
- Deletion rare event, extra safety delay

### 4. **Persistence Timing**

**Decision**: Fire-and-forget async persistence after Codex execution

**Rationale**:
- Non-blocking for orchestrator response
- Acceptable to lose reasoning on crash (not critical path)
- Retry logic adds complexity without proportional benefit

**Trade-offs**:
- No guarantee of persistence
- Simplifies error handling
- Matches eventual consistency model

### 5. **Autonomy Gradient Updates**

**Decision**: Update autonomy based on reasoning quality + outcome

**Evidence Weights**:
- Successful execution with good reasoning: +0.15 autonomy
- Failed execution with good reasoning: +0.05 autonomy (learning value)
- Successful execution with poor reasoning: +0.05 autonomy (lucky)
- Failed execution with poor reasoning: -0.15 autonomy

**Reasoning Quality Factors**:
- Has decision points: +0.15
- Considers alternatives: +0.15
- Uses causal reasoning: +0.10
- Substantial length (>50 chars): +0.10

### 6. **Graph Traversal Performance**

**Decision**: Add PostgreSQL indexes in future Phase 4 (mentioned in schema TODOs)

**Required Indexes**:
```sql
CREATE INDEX idx_memory_nodes_kind ON memory_nodes(kind);
CREATE INDEX idx_memory_nodes_resource_hash ON memory_nodes(resource, hash);
CREATE INDEX idx_memory_edges_from_kind ON memory_edges(from_id, kind);
CREATE INDEX idx_memory_edges_to_kind ON memory_edges(to_id, kind);
CREATE INDEX idx_memory_nodes_created ON memory_nodes(created DESC);
```

**Rationale**:
- Deferred to avoid premature optimization
- Clear requirements after Phase 1-3 implementation
- Measurable performance impact when needed

---

## Implementation Order

**Critical Path** (implement first):

1. **Phase 1** (codex.ts changes) - Enables data collection
   - Files: `packages/agent/src/orchestrator/tool/codex.ts`
   - Estimated: 2-3 hours

2. **Phase 2** (extraction + persistence) - Stores reasoning
   - Files: `packages/knowledge/src/extractor.ts`, `packages/agent/assistant/src/graphstore.ts`
   - Estimated: 4-5 hours

3. **Phase 3** (cognitive state) - Uses reasoning
   - Files: `packages/cognitive/src/state.ts`, `packages/cognitive/src/flows.ts`
   - Estimated: 3-4 hours

**Secondary Path** (implement after core):

4. **Phase 6** (learning integration) - Improves from reasoning
   - Files: `packages/learning/src/self_supervision.ts`, `packages/learning/src/mistake_ledger.ts`
   - Estimated: 2-3 hours

5. **Phase 4** (compression) - Manages growth
   - Files: `packages/knowledge/src/compression.ts`, `packages/db/src/repo/graph.ts` extensions
   - Estimated: 6-8 hours

6. **Phase 5** (query enhancements) - Retrieval
   - Files: `packages/knowledge/src/query.ts`
   - Estimated: 2-3 hours

7. **Phase 6** (background worker) - Automation
   - Files: `packages/agent/src/orchestrator/compression-worker.ts`
   - Estimated: 3-4 hours

**Total Estimated Effort**: 22-30 hours

---

## Dependencies & Prerequisites

**Type Dependencies** (need to ensure these exist):

- `@alfred/type/knowledge`: Defines `KnowledgeFact`, `KnowledgeInsight`, `KnowledgeRelation`, `KnowledgeUpdate`, `KnowledgeConfidence`
- `@alfred/type/cognitive`: Defines `CaptureResult`, `CognitiveConfidence`, `ExecutionPlan`, `ExecutionResult`, `ReflectionResult`, `SynthesisResult`
- `@alfred/type/stream`: Defines `UIMessage`, `ModelMessage`

**Package Imports** (add to package.json):

```json
{
  "dependencies": {
    "@alfred/knowledge": "workspace:*",
    "@alfred/cognitive": "workspace:*",
    "@alfred/learning": "workspace:*",
    "@alfred/db": "workspace:*",
    "@alfred/type": "workspace:*"
  }
}
```

**Database Migration** (for compression support):

```typescript
// Migration: Add archived column to memory_nodes
// File: packages/db/src/migrations/NNNN_add_archived_support.ts

export async function up(db) {
  // Properties JSONB already supports archived field
  // Add index for archived queries
  await db.schema.raw(`
    CREATE INDEX idx_memory_nodes_archived 
    ON memory_nodes ((properties->>'archived'))
    WHERE properties->>'archived' IS NOT NULL;
  `);

  await db.schema.raw(`
    CREATE INDEX idx_memory_nodes_confidence
    ON memory_nodes (((properties->>'confidence')::numeric))
    WHERE properties ? 'confidence';
  `);
}
```

---

## Configuration

**Environment Variables** (add to `.env`):

```bash
# Compression Worker Config
COMPRESSION_ENABLED=true
COMPRESSION_INTERVAL_MS=3600000  # 1 hour
COMPRESSION_HALF_LIFE_MS=604800000  # 7 days
COMPRESSION_MIN_CONFIDENCE=0.3
COMPRESSION_MAX_AGE_MS=2592000000  # 30 days

# Reasoning Config
REASONING_MIN_LENGTH=10
REASONING_MAX_STORED=1000
REASONING_CONFIDENCE_BASE=0.7
```

**Runtime Configuration** (in orchestrator):

```typescript
// packages/agent/src/orchestrator/config.ts
export const REASONING_CONFIG = {
  extraction: {
    minLength: parseInt(process.env.REASONING_MIN_LENGTH ?? "10"),
    maxStored: parseInt(process.env.REASONING_MAX_STORED ?? "1000"),
    baseConfidence: parseFloat(process.env.REASONING_CONFIDENCE_BASE ?? "0.7"),
  },
  compression: {
    enabled: process.env.COMPRESSION_ENABLED === "true",
    intervalMs: parseInt(process.env.COMPRESSION_INTERVAL_MS ?? "3600000"),
    halfLifeMs: parseInt(process.env.COMPRESSION_HALF_LIFE_MS ?? "604800000"),
    minConfidence: parseFloat(process.env.COMPRESSION_MIN_CONFIDENCE ?? "0.3"),
    maxAgeMs: parseInt(process.env.COMPRESSION_MAX_AGE_MS ?? "2592000000"),
  },
};
```

---

## Testing Strategy

**Unit Tests**:
1. `extractReasoning()` - Verify decision/alternative detection
2. `decayConfidence()` - Validate decay formula
3. `consolidatePatterns()` - Check pattern creation logic
4. `evaluateReasoningQuality()` - Test scoring heuristics

**Integration Tests**:
1. Codex execution → reasoning extraction → persistence flow
2. Compression worker cycle
3. Reasoning chain reconstruction
4. Autonomy gradient updates

**Performance Tests**:
1. Batch operations scale (1k, 10k, 100k nodes)
2. Query performance on reasoning chains
3. Compression cycle duration

---

## Metrics & Monitoring

**Key Metrics to Track**:

```typescript
// Add to packages/agent/src/metrics/reasoning.ts
export const REASONING_METRICS = {
  tracesExtracted: "reasoning.traces.extracted",
  tracesStored: "reasoning.traces.stored",
  tracesFailed: "reasoning.traces.failed",
  compressionCycles: "reasoning.compression.cycles",
  nodesArchived: "reasoning.compression.archived",
  nodesDeleted: "reasoning.compression.deleted",
  patternsCreated: "reasoning.patterns.created",
  queryLatency: "reasoning.query.latency",
};
```

**Dashboards**:
- Reasoning trace volume over time
- Compression effectiveness (nodes archived/deleted)
- Pattern consolidation rate
- Query performance trends
- Autonomy gradient evolution

---

## Future Enhancements

**Phase 8** (not in current scope):

1. **Semantic Similarity Indexing**
   - Integrate embedding generation for reasoning traces
   - Use RTree spatial index for similarity search
   - Enable "find similar reasoning" queries

2. **ML-Based Quality Scoring**
   - Train classifier on reasoning → outcome pairs
   - Replace heuristic scoring with learned model
   - Continuous learning from new executions

3. **Interactive Reasoning Replay**
   - UI component for visualizing reasoning chains
   - Step-through debugging of agent decisions
   - Counterfactual analysis ("what if" scenarios)

4. **Cross-Execution Pattern Mining**
   - Identify common reasoning patterns across tasks
   - Extract reusable reasoning templates
   - Transfer learning between similar problems

5. **Reasoning Compression to Rules**
   - Convert frequent reasoning patterns to production rules
   - Fast-path execution for recognized patterns
   - Hybrid symbolic/neural reasoning system

---

This implementation plan provides a complete blueprint for integrating Codex CLI reasoning into ALFRED's cognitive memory system. Each phase is self-contained with clear dependencies, enabling incremental implementation and testing.
