# ALFRED Memory System Enhancements

This document describes the memory system enhancements implemented based on the frontier AI research review (`docs/review/alfred-memory-review.md`).

## Overview

The memory system has been enhanced with:

1. **Tier 1: Quick Wins** - Low-risk, high-impact improvements
2. **Tier 2: Moderate Complexity** - Algorithm improvements
3. **Tier 3: Strategic Enhancements** - Advanced capabilities

## Tier 1: Quick Wins

### 1.1 Increased Domain Cache TTL

**Location**: `packages/knowledge/src/lexicon/domains.ts`, `packages/knowledge/src/lexicon/code.ts`

The domain cache TTL was increased from 60 seconds to 300 seconds (5 minutes) based on research showing 300-600s is optimal for preference data.

**Metrics**: `alfred_domain_cache_hits_total`

### 1.2 Int8 Quantization for Embeddings

**Location**: `packages/embed/src/quantize.ts`

Implements symmetric Int8 quantization for embedding vectors:
- 4x storage reduction (1024-dim: 4KB → 1KB)
- 97%+ cosine similarity retention
- Direct similarity computation on quantized vectors

```typescript
import { quantizeToInt8, dequantizeFromInt8 } from "@alfred/embed";

const quantized = quantizeToInt8(embedding);
const reconstructed = dequantizeFromInt8(quantized);
```

**Metrics**: `alfred_embedding_quantizations_total`, `alfred_embedding_storage_saved_bytes`

### 1.3 Tiered Seed Confidence

**Location**: `packages/knowledge/src/ontology.ts`

Seed knowledge is assigned different confidence levels based on source type:

| Source Type | Confidence | Description |
|-------------|------------|-------------|
| official | 0.8 | Official documentation, verified facts |
| established | 0.7 | Well-established community knowledge |
| inferred | 0.5 | Inferred relationships |
| community | 0.5 | Community-sourced knowledge |
| preference | 0.4 | User-specific preferences |

## Tier 2: Moderate Complexity

### 2.1 Access-Based Adaptive Decay

**Location**: `packages/db/src/schema/graph.ts`, `packages/knowledge/src/compression.ts`

Nodes that are accessed more frequently decay slower using the formula:

```
effective_half_life = base_half_life × (1 + log(1 + access_count))
```

| Access Count | Decay Multiplier |
|--------------|------------------|
| 0 | 1.0x |
| 9 | ~3.3x slower |
| 99 | ~5.6x slower |
| 999 | ~7.9x slower |

**Schema**: Added `access_count` and `last_accessed_at` columns to `memory_nodes`.

**Migration**: `0049_access_tracking.sql`

**Metrics**: `alfred_adaptive_decay_operations_total`, `alfred_node_access_count`

### 2.2 Top-K Retrieval with Downstream Filtering

**Location**: `packages/db/src/repo/graph/scoring.ts`, `packages/db/src/repo/graph/traverse.ts`

Replaced static similarity threshold (0.5) with top-K retrieval:
- Retrieve K candidates (default: 20)
- Apply downstream quality filtering (minScore: 0.3)
- Enables better recall while maintaining precision

```typescript
import { scoreAndRankNodes, DEFAULT_TOP_K } from "@alfred/db/repo/graph";

const results = scoreAndRankNodes(nodes, queryEmbedding, {
  topK: 20,
  minScore: 0.3,
});
```

### 2.3 Domain-Adaptive Override Thresholds

**Location**: `packages/knowledge/src/lexicon/threshold.ts`

Per-domain thresholds that calibrate based on correction history:

```
threshold = base_threshold × (1 - error_rate) + min_threshold × error_rate
```

Domains with high error rates get lower thresholds (trust learned more).

**Schema**: Added `domain_thresholds` table.

**Migration**: `0050_domain_thresholds.sql`

**Metrics**: `alfred_domain_threshold_calibrations_total`, `alfred_domain_threshold`, `alfred_domain_accuracy`

## Tier 3: Strategic Enhancements

### 3.1 DSA-BFS (Dynamic Similarity-Aware BFS)

**Location**: `packages/db/src/repo/graph/dsa-bfs.ts`

A graph traversal algorithm that prioritizes nodes by semantic similarity:

- Uses priority queue instead of FIFO queue
- Priority = similarity × similarityWeight + depthFactor × depthWeight
- Early termination when high-similarity match found
- Reduces average traversal depth

```typescript
import { dsaBfs, type DsaBfsOptions } from "@alfred/db/repo/graph";

const result = await dsaBfs(
  startNode,
  queryEmbedding,
  getNeighbors,
  targetPredicate,
  { maxDepth: 5, maxExpansions: 100, earlyTerminationThreshold: 0.9 }
);
```

**Metrics**: `alfred_dsa_bfs_traversals_total`, `alfred_dsa_bfs_expansions`, `alfred_dsa_bfs_duration_seconds`

### 3.2 CRAG-Style Retrieval Evaluator

**Location**: `packages/rag/src/evaluator.ts`

Implements Corrective RAG evaluation with three decision types:

| Action | Score Range | Description |
|--------|-------------|-------------|
| USE | ≥0.7 | Results are high quality |
| REFINE | 0.3-0.7 | Results are ambiguous |
| FALLBACK | <0.3 | Results are poor |

```typescript
import { evaluateRetrieval } from "@alfred/rag";

const result = evaluateRetrieval(query, documents);
if (result.action === "fallback") {
  // Trigger web search or alternative source
}
```

**Metrics**: `alfred_crag_evaluations_total`, `alfred_crag_score`

### 3.3 ADWIN Concept Drift Detection

**Location**: `packages/agent/src/drift/adwin.ts`, `packages/agent/src/drift/monitor.ts`

Implements ADWIN (ADaptive WINdowing) algorithm:

- Automatically detects distribution changes in streaming data
- Maintains variable-length window that shrinks on drift
- No prior knowledge of drift timing required

```typescript
import { createDriftMonitor } from "@alfred/agent/drift";

const monitor = createDriftMonitor({
  onDrift: (event) => {
    console.log(`Drift detected in ${event.domain}`);
  },
});

// Record observations
monitor.recordClassification("Coding", wasCorrect);
```

**Metrics**: `alfred_concept_drift_detections_total`, `alfred_concept_drift_window_size`

### 3.4 Bi-Temporal Edges

**Location**: `packages/db/src/schema/graph.ts`, `packages/db/src/repo/graph/temporal.ts`

Implements Zep-style bi-temporal model:

- `valid_from`/`valid_to`: When the edge is valid in the real world
- `created_at`: When we learned about the edge (transaction time)

Benefits:
- Non-destructive updates (soft deletes)
- Historical queries ("what did the graph look like at time X?")
- Audit trail of all changes

```typescript
import { softDeleteEdge, getGraphSnapshot, supersededEdge } from "@alfred/db/repo/graph";

// Soft delete preserves history
await softDeleteEdge(edgeId);

// Get graph at a specific point in time
const snapshot = await getGraphSnapshot(new Date("2024-01-01"));

// Update edge non-destructively
await supersededEdge(oldEdgeId, { weight: 0.9 });
```

**Migration**: `0051_bitemporal_edges.sql`

**Metrics**: `alfred_bitemporal_edge_operations_total`, `alfred_bitemporal_historical_queries_total`

## Explicit Memory Tools

The agent has access to explicit memory tools that provide direct control over the knowledge graph and conversation history. These tools enable the agent to actively manage memories rather than relying solely on implicit background processing.

**Location**: `packages/agent/assistant/src/tool/memory/`

### Available Tools

| Tool | Description | Key Operations |
|------|-------------|----------------|
| `memory_search` | Semantic search through memories | Query embedding, similarity scoring, top-K retrieval |
| `memory_retrieve` | Get specific memory by ID | Full details, optional neighbor expansion |
| `memory_update` | Update memory metadata | Confidence, properties, label |
| `memory_remove` | Remove a memory | Soft delete (archive) or hard delete |
| `memory_boost` | Reinforce a memory | Increase confidence by configurable amount |
| `memory_traverse` | Walk the knowledge graph | Simple BFS or semantic DSA-BFS traversal |
| `memory_history` | Review conversation history | List conversations, get messages, search |
| `memory_stats` | System health metrics | Node counts, confidence distribution, access patterns |

### Usage Examples

#### Semantic Search
```typescript
// Agent can search memories by meaning
const result = await memory_search({
  query: "user's preferred programming languages",
  resource: "user",
  topK: 10,
  minScore: 0.5
});
```

#### Memory Reinforcement
```typescript
// When agent confirms information is correct, boost confidence
await memory_boost({
  id: nodeId,
  amount: 0.15,
  reason: "User confirmed this preference"
});
```

#### Graph Traversal
```typescript
// Explore related knowledge using semantic DSA-BFS
const result = await memory_traverse({
  startId: factId,
  query: "related programming concepts",
  maxDepth: 3,
  direction: "both"
});
```

#### Conversation Review
```typescript
// Review past conversations for context
const history = await memory_history({
  userId: "user-1",
  conversationId: conversationId,
  limit: 20,
  search: "project requirements"
});
```

### Tool Registration

Memory tools are automatically registered in `packages/agent/src/v6.ts`:

```typescript
import { memoryTools } from "../assistant/src/tool/memory";

const assistantToolSources: LegacyTool[] = [
  // ... other tools
  ...memoryTools,
];
```

### Metrics

Memory tool operations emit Prometheus metrics:

- `alfred_memory_tool_calls_total{tool, status}` - Tool call counts
- `alfred_memory_search_latency_seconds` - Search latency
- `alfred_memory_search_results_count` - Results per search
- `alfred_memory_traverse_depth` - Traversal depth reached
- `alfred_memory_boosts_total` - Boost operations
- `alfred_memory_removals_total{type}` - Removals by type (archived/deleted)

### Testing

```bash
# Run memory tool tests
cd packages/agent && bun test test/tool/memory.test.ts
```

The test suite includes 44 tests covering:
- Embedding utilities (embedQuery, embedTexts, normalizeEmbedding)
- Tool input validation (Zod schemas)
- Tool execution with mocked dependencies
- Tool metadata verification

## Prometheus Metrics

All new metrics are prefixed with `alfred_` and registered in `packages/api/src/metrics.ts`:

### Classification Metrics
- `alfred_classification_source_total{domain, source}` - Classification sources
- `alfred_classification_accuracy_total{domain, outcome}` - Accuracy tracking
- `alfred_classification_duration_seconds{method}` - Latency
- `alfred_domain_cache_hits_total{result}` - Cache efficiency

### Memory System Metrics
- `alfred_embedding_quantizations_total{status}` - Quantization operations
- `alfred_embedding_storage_saved_bytes` - Storage savings
- `alfred_adaptive_decay_operations_total{outcome}` - Decay operations
- `alfred_node_access_count` - Access count distribution

### Retrieval Metrics
- `alfred_dsa_bfs_traversals_total{outcome}` - Traversal outcomes
- `alfred_dsa_bfs_expansions` - Expansion count distribution
- `alfred_dsa_bfs_duration_seconds` - Traversal latency
- `alfred_crag_evaluations_total{action}` - Evaluation decisions
- `alfred_crag_score` - Score distribution

### Drift Detection Metrics
- `alfred_concept_drift_detections_total{domain}` - Drift events
- `alfred_concept_drift_window_size{domain}` - Window sizes

### Bi-Temporal Metrics
- `alfred_bitemporal_edge_operations_total{operation}` - Edge operations
- `alfred_bitemporal_historical_queries_total` - Historical queries

## Database Migrations

Run migrations in order:

```bash
cd packages/db && bun run db:migrate
```

New migrations:
- `0048_embedding_quantization.sql` - Quantized embedding column
- `0049_access_tracking.sql` - Access count columns
- `0050_domain_thresholds.sql` - Threshold calibration table
- `0051_bitemporal_edges.sql` - Temporal validity columns

## Testing

Run the test suite:

```bash
# Unit tests
cd packages/knowledge && bun test
cd packages/embed && bun test

# Integration tests
cd packages/knowledge && bun test memory-system.test.ts
```

## Performance Budgets

| Operation | Budget | Measured |
|-----------|--------|----------|
| Domain classification | <1ms | ~0.3ms |
| Threshold calculation | <0.1ms | ~0.01ms |
| Access multiplier | <0.01ms | ~0.001ms |
| DSA-BFS traversal | <100ms | ~50ms p99 |
| CRAG evaluation | <10ms | ~5ms |
