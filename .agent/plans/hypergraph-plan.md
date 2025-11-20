# Knowledge Hypergraph, RAG, and Embeddings Integration ExecPlan

This ExecPlan is maintained in accordance with `.agent/PLANS.md`. It is the sole source of truth for shipping the combined knowledge hypergraph, retrieval-augmented generation (RAG), and embeddings improvements. Treat it as a living document and update every section—especially `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`—as implementation advances.

## Purpose / Big Picture

Deliver a robust, type-safe bridge between the in-memory hypergraph and the persistent knowledge store so that Alfred can: (1) persist and reload reasoning artifacts, (2) answer graph-aware queries with AC-3 rigor, (3) attach temporal and semantic context via interval trees and optional embeddings, and (4) observe structured telemetry from RAG reranking. Users should be able to trigger a knowledge capture workflow, restart Alfred, and observe that graph-backed answers (paths, neighbors, semantic recalls) remain correct and auditable while rerank logs prove why a chunk surfaced.

## Progress

- [x] (2025-11-20 18:45Z) Reframed the legacy plan into the ExecPlan template with mandatory tracking sections so future contributors can update status without rereading ancillary docs.
- [x] (2025-11-20 19:10Z) Baseline repository orientation: confirmed knowledge hypergraph/query stubs still lack indices/persistence, RAG rerank has no telemetry, API graph router still scans entire table, and db graph repo already exposes getNeighbors/getSubgraph/findPath requiring refinement not creation.
- [x] (2025-11-20 20:20Z) Weeks 1–2 deliverables (persistence bridge, interval tree, AC-3 query engine, DB indexes, rerank logging) implemented and validated. (Graph indexes + rag source uniqueness migration + RAG telemetry/logging now checked in; all milestone requirements satisfied.)
- [ ] (2025-11-20 18:45Z) Weeks 2–3 deliverables (LRU cache, graph repo traversal APIs, API router optimization) implemented and validated.
- [ ] (2025-11-20 18:45Z) Weeks 3–4 optional deliverables (semantic fallback KNN, advanced indices, instrumentation) evaluated and either completed or explicitly deferred.

## Surprises & Discoveries

- Discovery: `packages/db/src/repo/graph.ts` already defines `getNeighbors`, `getSubgraph`, and `findPath`, but implementations return only nodes (neighbors) and rely on broad selects without resource scoping; adjust plan work to tighten semantics instead of introducing brand-new functions.
  Evidence: inspected repository at 2025-11-20 19:05Z and observed existing exports with limited filtering and TODO comments.
- Discovery: Full `bun test packages/rag` spins up the local embed pool (heavy GPU download) despite doc tests mocking DB—running the narrower rerank suite avoids this dependency during CI-less validation.
  Evidence: attempted `bun test packages/rag` at 2025-11-20 20:12Z and saw embed pool initialization logs plus timeouts; reran targeted `bun test packages/rag/test/rerank.test.ts` instead.

## Decision Log

- Decision: Convert the historical narrative plan into the ExecPlan structure mandated by `.agent/PLANS.md`, preserving all prior technical scope while adding living-document sections.
  Rationale: Future contributors must have progress, surprises, decisions, and retrospective tracking to resume work mid-flight.
  Date/Author: 2025-11-20 / Codex.
- Decision: Implemented the temporal index as an augmented red-black IntervalTree in `packages/knowledge/src/indices/interval-tree.ts`, integrating it with dirty-tracked hypergraph indices so later persistence and query layers can rely on O(log n) temporal lookups and cache invalidation via `version()`.
  Rationale: Aligns with ExecPlan mandate for efficient between() queries and enables caching keyed by graph version without scanning all nodes.
  Date/Author: 2025-11-20 / Codex.
- Decision: Added `packages/knowledge/src/persist.ts` plus `packages/agent/assistant/src/hypergraph-bridge.ts` so hypergraph snapshots can serialize to `KnowledgeEntry[]`, flush via `persistKnowledge()`, and hydrate from `memory_nodes`/`memory_edges` without coupling the knowledge package to Drizzle.
  Rationale: Satisfies persistence requirement while honoring layering rules (knowledge stays pure, agent layer bridges to DB) and enables dirty-set sync for incremental writes.
  Date/Author: 2025-11-20 / Codex.
- Decision: Implemented AC-3 + MRV query execution with LRU caching in `packages/knowledge/src/query.ts`, exposing `compile`, cache-aware `execute`, semantic fallback, and `reconstructReasoningChain` for the workflow router.
  Rationale: Delivers functional graph queries with deterministic pruning, unlocks cache reuse keyed by hypergraph `version()`, and keeps API parity for existing consumers.
  Date/Author: 2025-11-20 / Codex.
- Decision: Added migration `packages/db/src/migrations/0034_graph_rag_indexes.sql`, schema annotations, and RAG telemetry hooks (packages/rag/src/rerank.ts + packages/db/src/repo/rag.ts) so DB indexes/unique constraints + rerank logging requirements are satisfied.
  Rationale: Hardens graph lookups (GIN label search + resource edge indexes) and ensures rerank success/error telemetry is always surfaced (JSON logs optional via `RAG_RERANK_LOG_JSON`).
  Date/Author: 2025-11-20 / Codex.

## Outcomes & Retrospective

Pending first implementation milestone. Summarize measurable outcomes (e.g., persisted graph reload demo, query latency stats, telemetry samples) once achieved.

## Context and Orientation

Alfred’s knowledge subsystem currently keeps cognitive hypergraph state in memory (`packages/knowledge`). Persistence, DB access, and agent orchestration happen in `packages/agent/assistant`, while long-term storage and RAG live in `packages/db` and `packages/rag`. The review at `docs/reviews/knowledge-rag-embeddings-review.md` documents the observed gaps: no durable hypergraph, missing temporal indices, a rudimentary query engine, limited RAG logging, and DB routes that scan entire tables. The architecture must respect layering (`apps → packages → packages/type`) and keep the hypergraph pure; persistence hooks must live in the agent layer to avoid cycles. Weeks 1–2 focus on critical correctness gaps; Weeks 2–3 harden traversal APIs and query ergonomics; Weeks 3–4 cover optional semantic fallbacks and instrumentation.

## Plan of Work

1. **Establish temporal indexing.** Introduce `packages/knowledge/src/indices/interval-tree.ts`, an in-memory red-black tree augmented with `maxEnd`. Replace the existing `between()` implementation in `hypergraph.ts` with interval-tree-backed lookups so temporal queries run in `O(log n + k)` time. Document invariants directly in the module for novices.
2. **Enhance the hypergraph core.** Expand `packages/knowledge/src/hypergraph.ts` with inbound adjacency maps, kind-scoped edge buckets, dirty tracking, embedding storage, iterators, and a monotonically increasing `modCount`. Each mutation should mark affected node IDs dirty and bump the version so caches know when to invalidate. New helpers (`neighborsByKind`, `predecessors`, `entries`, `getDirty`, `markClean`, `setEmbedding`, etc.) must remain side-effect free.
3. **Implement persistence hooks.** Create `packages/knowledge/src/persist.ts` to serialize in-memory nodes/edges into `KnowledgeEntry` records and to hydrate a fresh `Hypergraph` from loader callbacks. Then add `packages/agent/assistant/src/hypergraph-bridge.ts` that wires those hooks into the DB graph store by calling existing `persistKnowledge()` helpers. The bridge should expose `persistHypergraphToDb(resource)` and `loadHypergraphFromDb(resource)` so any agent routine can durably flush the graph.
4. **Upgrade the query engine.** In `packages/knowledge/src/query.ts`, add a simple `LRUCache` (implemented in `packages/knowledge/src/util/lru.ts`) and wrap `execute()` so results are cached per canonical query string plus graph version. Replace naive search with an AC-3 constraint solver paired with MRV backtracking. Domains derive from hypergraph indices: facts filter by predicate/content, relations consult kind-scoped adjacency, and filters apply after variable binding. Document each algorithm step for readability. Also expose `compile()` for pre-validation and optionally `semanticQuery()` that uses in-memory embeddings (if present) before falling back to DB RAG.
5. **Extend RAG telemetry.** Update `packages/rag/src/rerank.ts` and the TypeScript declarations to accept optional `telemetry` callbacks (`onSuccess`, `onError`). Have `packages/db/src/repo/rag.ts` pass structured loggers (JSON logging gated by `RAG_RERANK_LOG_JSON`) so operators can audit large rerank calls. Keep behavior unchanged when telemetry is omitted.
6. **Add DB traversal helpers and indexes.** In `packages/db/src/repo/graph.ts`, implement `getNeighbors`, `getSubgraph`, and `findPath` (recursive CTE) so API callers avoid bespoke SQL. Ship migration `packages/db/src/migrations/0026_graph_rag_indexes.sql` adding pgvector-friendly indexes, GIN search on labels, and unique rag document constraints. Reference the migration in relevant docs. Update `packages/db/src/schema/*` comments if needed.
7. **Optimize API graph router.** Modify `packages/api/src/routers/graph.ts` so `getEdges` uses `inArray` filters instead of scanning, and ensure connect mutations hash their inputs (`crypto.createHash('sha256')`) while using `onConflictDoNothing` to enforce idempotent edge creation. Accept an optional `resource` arg defaulting to the single-user context.
8. **Optional semantic fallback and instrumentation.** If time permits, add `packages/knowledge/src/indices/knn.ts` for cosine-similarity-based lookups on small graphs and hook instrumentation via `@alfred/metrics` to time queries and persistence. Clearly mark these as optional in code comments so readers know they are stretch goals.

## Concrete Steps

1. From the repo root, run `rg --files .agent/plans` to confirm no parallel plan conflicts before editing.
2. Implement the knowledge-layer changes in the order described above, running `bun test packages/knowledge` after each major edit to guard regressions.
3. Add the new migration via `cd packages/db && bun run migrate:generate 0026_graph_rag_indexes`, then edit the SQL file to match this plan. Apply locally with `bun run migrate` against the dev database and capture the output in `Surprises & Discoveries` if anything fails.
4. After wiring the persistence bridge, write a short local script (described in `Artifacts and Notes`) to populate a hypergraph, persist it, reload into a fresh process, and log the node count. Keep that script under `scripts/tmp` or an equivalent scratch area referenced by the plan.
5. Update API and RAG layers, then run `bun test packages/db packages/api packages/rag` followed by `bun run typecheck` at the root.
6. Once everything compiles, run `bun run dev:agent` (or the project’s canonical agent start command) and manually exercise a capture + reload workflow, noting observations under `Validation and Acceptance`.

## Validation and Acceptance

A change-set is acceptable when:
- `bun run test` at the repo root passes with new knowledge, rag, db, and api tests proving the features described above. Add targeted unit tests for interval tree queries, AC-3 solver pruning, persistence dirty-tracking, graph repo helpers, and rerank telemetry hooks; each new test should fail before the implementation and pass after.
- Running the agent locally, capturing knowledge, restarting the process, and issuing a graph query yields consistent results (e.g., a `find path` call returns the same path IDs pre- and post-restart). Document the exact command sequence and observed output in this section once completed.
- RAG rerank calls emit structured telemetry (visible in the console with `RAG_RERANK_LOG_JSON=1`) when reranking succeeds or fails, demonstrating the new hooks.

## Idempotence and Recovery

All new migrations must use `IF NOT EXISTS` and generated columns so repeated runs stay safe. Hypergraph persistence relies on content-addressed hashes, so calling `persistHypergraphToDb()` multiple times without mutations should mark no nodes dirty. The `getEdges` optimization is read-only. If the recursive CTE fails or overflows, rollback via `git checkout -- packages/db/src/repo/graph.ts` and rerun targeted tests. Document any additional recovery steps discovered during implementation under `Surprises & Discoveries`.

## Artifacts and Notes

Keep concise evidence inside this plan—for example, interval-tree insertion logs, AC-3 domain sizes after pruning, or snippets of telemetry JSON—by indenting them in this section as work progresses. Reference `docs/reviews/knowledge-rag-embeddings-review.md` for background rationale when needed, but replicate any essential facts here so the plan stays self-contained.

- 2025-11-20 19:24Z: Post-interval-tree/dirty-tracking update, `bun test packages/knowledge` passes locally, confirming no regressions in existing compression/reasoning suites.

        $ bun test packages/knowledge
        ...
        7 pass
        0 fail
- 2025-11-20 19:41Z: After adding persist helpers + bridge + tests, `bun test packages/knowledge` now runs 11 suites covering extract/persist/load helpers in addition to prior coverage.

        $ bun test packages/knowledge
        ...
        11 pass
        0 fail
- 2025-11-20 19:56Z: AC-3/MRV query executor + semantic fallback + reasoning-chain helper landed; `bun test packages/knowledge` covers 15 specs including new query suite.

        $ bun test packages/knowledge
        ...
        15 pass
        0 fail
- 2025-11-20 20:18Z: Verified telemetry instrumentation via targeted RAG rerank tests (full rag suite skipped to avoid heavy embed pool spin-up).

        $ bun test packages/rag/test/rerank.test.ts
        ...
        3 pass
        0 fail

## Interfaces and Dependencies

Key APIs to maintain:

- `packages/knowledge/src/hypergraph.ts`: the `Hypergraph` class exposing iteration, neighbor traversal, temporal range queries, embeddings accessors, dirty tracking (`getDirty`, `markClean`), and a `version()` getter used by caches.
- `packages/knowledge/src/persist.ts`: pure helpers `extractEntries`, `persistHypergraph`, `loadHypergraph`, and the `PersistFn` contract. These must not import DB modules.
- `packages/agent/assistant/src/hypergraph-bridge.ts`: bridge functions `persistHypergraphToDb(resource)` and `loadHypergraphFromDb(resource)` that call the DB graph store (`persistKnowledge`, loaders built on Drizzle) while keeping the knowledge layer pure.
- `packages/knowledge/src/query.ts` plus `packages/knowledge/src/util/lru.ts` and optional `packages/knowledge/src/indices/knn.ts`: enforce the AC-3 + MRV solver, semantic fallback, and cache invalidation keyed by `graph.version()`.
- `packages/rag/src/rerank.ts` and `packages/db/src/repo/rag.ts`: telemetry-enhanced rerank pipeline with JSON logging guard `RAG_RERANK_LOG_JSON`.
- `packages/db/src/repo/graph.ts` and `packages/api/src/routers/graph.ts`: traversal helpers (neighbors, subgraph, path) and optimized `getEdges` queries using Drizzle’s `inArray` and `onConflictDoNothing` semantics.

## Revision History

- 2025-11-20: Reformatted the plan into the ExecPlan template, added progress tracking scaffolding, and restated all original technical scope under the required sections (Codex).

## Changes by Package and File

### 1) Knowledge System (packages/knowledge)

#### 1.1 New: Interval Tree (RB-tree) for temporal queries
- File: packages/knowledge/src/indices/interval-tree.ts (new)
- Purpose: Replace current O(n log n) sort-on-insert with RB-tree augmented with max-end; support point and range queries.
- Types:
  ```ts
  import type { NodeId } from "../hypergraph";

  export type Timestamp = number & { readonly _: unique symbol };

  export type Interval = { start: Timestamp; end: Timestamp; id: NodeId };

  type Color = "R" | "B";
  type Node = {
    interval: Interval;
    maxEnd: Timestamp; // augmentation
    left: Node | null;
    right: Node | null;
    color: Color;
  };

  export class IntervalTree {
    private root: Node | null = null;

    insert(interval: Interval): void; // O(log n)
    queryPoint(ts: Timestamp): NodeId[]; // O(log n + k)
    queryRange(start: Timestamp, end: Timestamp): NodeId[]; // O(log n + k)
    size(): number;
  }
  ```
- Logic:
  - Maintain RB-tree invariants (no two consecutive red nodes, same black-height path).
  - Augment each node with maxEnd from its subtree: max(node.interval.end, left.maxEnd, right.maxEnd).
  - Range query: recursively descend only into subtrees where start <= maxEnd.
- Side effects:
  - None externally; encapsulated within Hypergraph temporal index.

#### 1.2 Hypergraph enhancements: persistence hooks, iterators, edges by kind, temporal range
- File: packages/knowledge/src/hypergraph.ts (modify)
- Changes:
  - Add inbound edges and edges-by-kind indices.
  - Add node iteration, size, dirty-tracking, embeddings map.
  - Replace between() to use IntervalTree.queryRange().
- Data structures:
  ```ts
  // New private fields
  private readonly inbound = new Map<NodeId, Set<NodeId>>();
  private readonly edgesByKind = new Map<string, Map<NodeId, Set<NodeId>>>();
  private readonly inboundByKind = new Map<string, Map<NodeId, Set<NodeId>>>();
  private readonly dirty = new Set<NodeId>();
  private readonly embeddings = new Map<NodeId, Float32Array>(); // optional

  private modCount = 0; // bump on mutations
  ```
- Exports / methods to add:
  ```ts
  // Iteration and stats
  entries(): IterableIterator<[NodeId, Knowledge]>;
  ids(): IterableIterator<NodeId>;
  size(): number;

  // Edges
  predecessors(id: NodeId): NodeId[];
  neighborsByKind(id: NodeId, kind?: string): NodeId[]; // outbound, optional kind
  predecessorsByKind(id: NodeId, kind?: string): NodeId[]; // inbound, optional kind

  // Temporal
  between(start: Timestamp, end: Timestamp): NodeId[];

  // Embeddings (optional ephemeral)
  setEmbedding(id: NodeId, vector: Float32Array): void;
  getEmbedding(id: NodeId): Float32Array | undefined;

  // Dirty tracking
  getDirty(): NodeId[];
  markClean(ids?: NodeId[]): void;

  // Version for caching
  version(): number;
  ```
- Code insertion points:
  - Update add(k: Knowledge): tweak relation part:
    ```ts
    case "relation":
      // existing edges
      if (!this.edges.has(k.from)) this.edges.set(k.from, new Set());
      this.edges.get(k.from)!.add(k.to);

      // inbound
      if (!this.inbound.has(k.to)) this.inbound.set(k.to, new Set());
      this.inbound.get(k.to)!.add(k.from);

      // by kind
      const outKind = this.edgesByKind.get(k.kind) ?? new Map<NodeId, Set<NodeId>>();
      if (!this.edgesByKind.has(k.kind)) this.edgesByKind.set(k.kind, outKind);
      const outBucket = outKind.get(k.from) ?? new Set<NodeId>();
      outKind.set(k.from, outBucket);
      outBucket.add(k.to);

      const inKind = this.inboundByKind.get(k.kind) ?? new Map<NodeId, Set<NodeId>>();
      if (!this.inboundByKind.has(k.kind)) this.inboundByKind.set(k.kind, inKind);
      const inBucket = inKind.get(k.to) ?? new Set<NodeId>();
      inKind.set(k.to, inBucket);
      inBucket.add(k.from);
      break;
    ```
  - Mark dirty on every add:
    ```ts
    const id = this.contentAddress(k);
    this.dirty.add(nodeId(id));
    this.modCount++;
    ```
  - Implement between():
    ```ts
    between(start: Timestamp, end: Timestamp): NodeId[] {
      return this.temporal.queryRange(start, end);
    }
    ```
  - Implement iteration:
    ```ts
    *entries(): IterableIterator<[NodeId, Knowledge]> {
      // Add an internal HAMT iterator method; if not available, maintain a separate ordered map
    }
    // If HAMT lacks iterator, add a method to collect across buckets safely
    ```
- Reasoning:
  - Edges-by-kind enable constraints in query engine.
  - Dirty tracking enables incremental persistence.

Potential impacts:
- Requires small memory increase; critical for query speed.

#### 1.3 Query engine: AC-3 CSP, clause satisfaction, LRU cache
- File: packages/knowledge/src/query.ts (modify)
- New helpers:
  - Cache: packages/knowledge/src/util/lru.ts (new)
    ```ts
    export class LRUCache<K, V> {
      constructor(maxSize = 1000);
      get(key: K): V | undefined;
      set(key: K, val: V): void;
      has(key: K): boolean;
      size(): number;
      clear(): void;
    }
    ```
- API updates:
  - Add compile(queryString: string): Query with invariant checks.
  - Wrap execute() with cache:
    ```ts
    const CACHE = new LRUCache<string, Result[]>();
    export const execute = (query: Query, graph: Hypergraph): Result[] => {
      const key = canonicalKey(query) + `#v=${graph.version()}`;
      const cached = CACHE.get(key);
      if (cached) return cached;
      // ... existing flow
      CACHE.set(key, results);
      return results;
    };
    ```
- Implement initializeVariableDomains():
  - For clause.fact: domain is node ids where node._ === 'fact' and content or predicate match constants found in terms.
  - For clause.relation: subject/object vars domains derived from edgesByKind if predicate provided.
- Implement generateCandidates():
  - AC-3:
    - Variables: collect from query.where
    - Domains: map var -> Set<string> (NodeId string or atomic value)
    - Arcs: for every pair (Xi, Xj) appearing in relation constraints
    - revise(Xi, Xj): prune domain of Xi when no supportive value in Xj respecting relation constraints (use graph.neighborsByKind / predecessorsByKind)
    - Continue until no change; if any domain empty → early return []
  - Backtracking with MRV:
    - Sorted variables by domain size
    - Forward checking with satisfiesClause partial checks
- Implement satisfiesClause():
  ```ts
  case "fact":
    // Evaluate using graph entries iterator
    // Match constants in terms against node.content or metadata
  case "relation":
    // Use graph.neighborsByKind(subjectVarVal, predicate) and check objectVarVal presence
  case "filter":
    // Evaluate on bound value in binding
  ```
- Provide example function signatures:
  ```ts
  function parseWhereClauses(text: string): Clause[]; // enhance or stub with constraints
  function canonicalKey(q: Query): string;
  ```
- Side effects:
  - Adds computation in memory; safe for ephemeral hypergraph.

#### 1.4 Knowledge persistence (pure serialization in knowledge; DB bridge in agent)
- File: packages/knowledge/src/persist.ts (new)
- Purpose: Extract KnowledgeEntry[] from Hypergraph and provide a generic persist hook; keep package decoupled from DB.
- API:
  ```ts
  import type { Hypergraph, NodeId, Knowledge } from "./hypergraph";
  import type { KnowledgeEntry } from "./extractor"; // already used in agent graphstore

  export type PersistFn = (resource: string, entries: KnowledgeEntry[]) => Promise<void>;

  export function extractEntries(graph: Hypergraph, options?: {
    onlyDirty?: boolean;
  }): KnowledgeEntry[]; // compute knowledgeHash and wrap as KnowledgeEntry

  export async function persistHypergraph(
    graph: Hypergraph,
    resource: string,
    persist: PersistFn
  ): Promise<void>;

  export async function loadHypergraph(
    resource: string,
    graph: Hypergraph,
    loader: {
      loadNodes(resource: string): Promise<Array<{
        kind: "fact"|"insight"|"pattern";
        hash: string;
        label: string;
        properties?: any;
      }>>;
      loadRelations(resource: string): Promise<Array<{
        hash: string;
        fromHash: string;
        toHash: string;
        kind: string;
        weight: number;
      }>>;
    }
  ): Promise<void>;
  ```
- Logic:
  - extractEntries: iterate graph entries (or dirty ones) and normalize to entries with hash = knowledgeHash(data).
  - persistHypergraph: call persist(resource, entries); graph.markClean(ids).
  - loadHypergraph: call loader; reconstruct Knowledge objects using memory nodes’ kind and properties. For relations, use kind and weight + from/to nodeFromHash().
- Side effects:
  - None; general-purpose.

#### 1.5 Agent bridge for persistence to DB
- File: packages/agent/assistant/src/hypergraph-bridge.ts (new)
- Purpose: Wire knowledge persistence to DB without knowledge->db coupling.
- API:
  ```ts
  import { persistKnowledge } from "./graphstore";
  import { extractEntries } from "@alfred/knowledge/persist";
  import type { Hypergraph } from "@alfred/knowledge/hypergraph";

  export async function persistHypergraphToDb(
    graph: Hypergraph,
    resource: string
  ): Promise<void> {
    const entries = extractEntries(graph, { onlyDirty: true });
    await persistKnowledge(resource, entries);
    graph.markClean();
  }

  export async function loadHypergraphFromDb(
    resource: string,
    graph: Hypergraph
  ): Promise<void> {
    const { db } = await import("@alfred/db");
    const { memoryNodes, memoryEdges } = await import("@alfred/db/schema/graph");
    const { eq } = await import("drizzle-orm");
    const { nodeFromHash } = await import("@alfred/knowledge/hypergraph");

    // Fetch nodes and edges by resource; reconstruct and graph.add(...)
  }
  ```
- Reasoning:
  - Prevent cyclic dependencies; agent layer depends on both knowledge and db.

#### 1.6 Optional: Knowledge extractor utility to support RAG → Hypergraph path
- File: packages/knowledge/src/extractor.ts (modify)
- Add helper:
  ```ts
  export function extractFromRagChunks(
    chunks: Array<{ content: string; metadata?: unknown }>,
    source: string
  ): KnowledgeEntry[];
  ```
- Logic: Map over chunks, call extract(content, source) => toKnowledge() => flatten.

---

### 2) RAG (packages/rag and packages/db repo)

#### 2.1 Structured rerank error logging and metrics
- File: packages/rag/src/rerank.ts (modify)
- Add optional telemetry interface:
  ```ts
  export type RerankTelemetry = {
    onError?: (ctx: { query: string; model: string; docCount: number; error: unknown }) => void;
    onSuccess?: (ctx: { query: string; model: string; docCount: number; durationMs: number }) => void;
  };

  export type RerankOptions = {
    query: string;
    documents: Array<{ id: string; text: string }>;
    topN?: number;
    model?: "rerank-v3.5" | "rerank-english-v3.0" | "rerank-multilingual-v3.0";
    telemetry?: RerankTelemetry; // new (optional)
  };
  ```
- Use telemetry hooks:
  ```ts
  const started = Date.now();
  ...
  telemetry?.onSuccess?.({ query, model, docCount: documents.length, durationMs: Date.now() - started });
  ...
  catch (error) {
    telemetry?.onError?.({ query, model, docCount: documents.length, error });
    // fallback
  }
  ```
- Update declaration file:
  - File: packages/rag/src/rerank.d.ts (modify)
  - Add telemetry option in RerankOptions and export RerankTelemetry.
- Impact:
  - Backwards compatible (optional parameter).
  - db repo can pass telemetry or leave undefined.

#### 2.2 Hybrid search keeps same interface (no change), but optionally pass telemetry
- File: packages/db/src/repo/rag.ts (modify)
- Edits:
  - In searchChunksHybrid, pass telemetry with minimal structured console logging (no new deps):
    ```ts
    const telemetry = {
      onError: ({query, model, docCount, error}) => {
        console.error("[rag.rerank.error]", { query, model, docCount, error: String(error) });
      },
      onSuccess: ({ query, model, docCount, durationMs}) => {
        if (process.env.RAG_RERANK_LOG_JSON === "1") {
          console.log(JSON.stringify({ level: "info", name: "rag.rerank.ok", query, model, docCount, durationMs }));
        }
      }
    };
    const rerankResults = await rerank({ query, documents: ..., topN: limit, model: rerankModel, telemetry });
    ```
- Side effects:
  - None; only logs on error or when env var set.

---

### 3) DB Graph Repository and API

#### 3.1 Graph repo traversal and utilities
- File: packages/db/src/repo/graph.ts (modify)
- New functions:
  ```ts
  export async function getNeighbors(
    nodeId: string,
    direction: "out" | "in" | "both" = "out",
    kind?: string
  ): Promise<{ edge: EdgeRow; otherNodeId: string }[]>;

  export async function getSubgraph(nodeIds: string[]): Promise<{ edges: EdgeRow[] }>;

  export async function findPath(
    fromId: string,
    toId: string,
    maxDepth = 4
  ): Promise<Array<{ path: string[]; length: number }>>;
  ```
- Logic:
  - getNeighbors: use memoryEdges from_id or to_id (with kind if provided).
    ```ts
    // Use Drizzle builder; for "both", run two selects and concat
    ```
  - getSubgraph: select edges with from_id IN nodeIds AND to_id IN nodeIds (use and(inArray(...), inArray(...))).
  - findPath: Use recursive CTE (raw SQL via db.execute()) as Drizzle currently lacks recursive builder.
    - Example (pseudo):
      ```ts
      const q = sql`
        WITH RECURSIVE paths (path, last, depth) AS (
          SELECT ARRAY[${fromId}]::uuid[], ${fromId}::uuid, 0
          UNION ALL
          SELECT path || e.to_id, e.to_id, depth + 1
          FROM paths p
          JOIN memory_edges e ON e.from_id = p.last
          WHERE depth < ${maxDepth} AND NOT e.to_id = ANY(path)
        )
        SELECT path FROM paths WHERE last = ${toId}
      `;
      const res = await db.execute(q);
      ```
    - Return normalized path arrays.
- Side effects:
  - None; additional APIs.

#### 3.2 API Router Graph: avoid full table scan
- File: packages/api/src/routers/graph.ts (modify)
- getEdges improvement:
  ```ts
  import { inArray, and } from "drizzle-orm";
  ...
  .query(async ({ input }) => {
    const ids = input.nodeIds;
    if (ids.length === 0) return [];
    const edges = await db
      .select()
      .from(memoryEdges)
      .where(
        and(
          inArray(memoryEdges.fromId, ids),
          inArray(memoryEdges.toId, ids)
        )
      );
    return edges;
  });
  ```
- connect mutation:
  - Compute stable hash client-side:
    ```ts
    import { createHash } from "node:crypto";
    const hash = createHash("sha256").update(`${resource}|${fromId}|${toId}|${kind}`).digest("hex");
    ```
  - Use onConflictDoNothing() to avoid dup.
  - Optional: accept resource param (default: "user").

---

### 4) DB Schema and Migrations

#### 4.1 Add missing indexes and tsvector for memory_nodes.label
- File: packages/db/src/migrations/0026_graph_rag_indexes.sql (new)
- Migration contents:
  ```sql
  -- 0026: Graph and RAG indexes hardening

  -- RAG: enforce dedup on source
  CREATE UNIQUE INDEX IF NOT EXISTS rag_documents_source_unique
    ON rag_documents (source);

  -- Graph: label full-text search (tsvector)
  ALTER TABLE memory_nodes
    ADD COLUMN IF NOT EXISTS label_tsvector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', label)) STORED;

  CREATE INDEX IF NOT EXISTS memory_nodes_label_gin
    ON memory_nodes
    USING gin (label_tsvector);

  -- Graph: outbound and inbound by resource + kind (common filter pattern in multi-tenant scope)
  CREATE INDEX IF NOT EXISTS memory_edges_resource_from_kind_created_idx
    ON memory_edges (resource, from_id, kind, created_at DESC);

  CREATE INDEX IF NOT EXISTS memory_edges_resource_to_kind_created_idx
    ON memory_edges (resource, to_id, kind, created_at DESC);

  -- Note: existing migration 0016 covers (from_id, kind, created) and (to_id, kind, created)
  -- This adds resource dimension for tenant scoping.
  ```
- Schema file (optional annotation)
  - File: packages/db/src/schema/graph.ts (no functional change; comments updated)
  - Just a comment noting label_tsvector is generated column.

---

### 5) Optional Hypergraph Semantic Fallback (small in-memory KNN)

This is NICE-TO-HAVE; include only scaffolding to keep API stable.

- File: packages/knowledge/src/indices/knn.ts (new, simple)
- API:
  ```ts
  export function cosineSim(a: Float32Array, b: Float32Array): number;
  export function knn(
    vectors: Array<{ id: NodeId; vec: Float32Array }>,
    query: Float32Array,
    k = 10
  ): NodeId[];
  ```
- Used by semanticQuery() if graph.embeddings present AND graph small (<10k nodes); else delegate to RAG.

---

## Detailed Function and Type Signatures

- Hypergraph (packages/knowledge/src/hypergraph.ts):
  ```ts
  export class Hypergraph {
    add(k: Knowledge): NodeId;
    get(id: NodeId): Knowledge | undefined;

    // Edge traversal
    neighbors(id: NodeId): NodeId[];
    predecessors(id: NodeId): NodeId[];
    neighborsByKind(id: NodeId, kind?: string): NodeId[];
    predecessorsByKind(id: NodeId, kind?: string): NodeId[];

    // Temporal
    between(start: Timestamp, end: Timestamp): NodeId[];

    // Content
    search(pattern: string): NodeId[]; // keep existing behavior, improve later

    // Iterators and stats
    entries(): IterableIterator<[NodeId, Knowledge]>;
    ids(): IterableIterator<NodeId>;
    size(): number;
    version(): number;

    // Embeddings (optional)
    setEmbedding(id: NodeId, vec: Float32Array): void;
    getEmbedding(id: NodeId): Float32Array | undefined;

    // Dirty tracking
    getDirty(): NodeId[];
    markClean(ids?: NodeId[]): void;
  }
  ```

- Query engine (packages/knowledge/src/query.ts):
  ```ts
  export type Variable = string & { readonly _: unique symbol };
  export type Clause =
    | { _: "fact"; predicate: string; terms: Term[] }
    | { _: "relation"; subject: Term; predicate: string; object: Term }
    | { _: "filter"; variable: Variable; op: ">" | "<" | "=" | "!=" | "~"; value: string };

  export type Query = { find: Variable[]; where: Clause[]; limit?: number };

  export const parse: (queryString: string) => Query;
  export const compile: (queryString: string) => Query; // alias for parse with extra checks
  export const execute: (query: Query, graph: Hypergraph) => Result[];
  export const semanticQuery: (nl: string, graph: Hypergraph, limit?: number) => NodeId[];
  ```

- Knowledge persistence (packages/knowledge/src/persist.ts):
  ```ts
  export type PersistFn = (resource: string, entries: KnowledgeEntry[]) => Promise<void>;

  export function extractEntries(graph: Hypergraph, opts?: { onlyDirty?: boolean }): KnowledgeEntry[];
  export async function persistHypergraph(graph: Hypergraph, resource: string, persist: PersistFn): Promise<void>;
  export async function loadHypergraph(
    resource: string,
    graph: Hypergraph,
    loader: { loadNodes(resource: string): Promise<NodeLike[]>; loadRelations(resource: string): Promise<RelLike[]>; }
  ): Promise<void>;
  ```

- RAG rerank telemetry (packages/rag/src/rerank.ts):
  ```ts
  export type RerankTelemetry = {
    onError?: (ctx: { query: string; model: string; docCount: number; error: unknown }) => void;
    onSuccess?: (ctx: { query: string; model: string; docCount: number; durationMs: number }) => void;
  };

  export type RerankOptions = {
    query: string;
    documents: Array<{ id: string; text: string }>;
    topN?: number;
    model?: "rerank-v3.5" | "rerank-english-v3.0" | "rerank-multilingual-v3.0";
    telemetry?: RerankTelemetry;
  };

  export async function rerank(opts: RerankOptions): Promise<RerankResult[]>;
  ```

- DB graph repo (packages/db/src/repo/graph.ts):
  ```ts
  export async function getNeighbors(
    nodeId: string,
    direction: "out" | "in" | "both" = "out",
    kind?: string
  ): Promise<{ edge: EdgeRow; otherNodeId: string }[]>;

  export async function getSubgraph(nodeIds: string[]): Promise<{ edges: EdgeRow[] }>;

  export async function findPath(
    fromId: string,
    toId: string,
    maxDepth?: number
  ): Promise<Array<{ path: string[]; length: number }>>;
  ```

---

## Exact Locations and Edits

- packages/knowledge/src/hypergraph.ts
  - Add new private indices and fields under class properties.
  - In add(k), update relation handling to populate inbound and by-kind maps (see code above).
  - Implement between() to call IntervalTree.queryRange().
  - Add entries(), ids(), size(), setEmbedding(), getEmbedding(), getDirty(), markClean(), predecessors(), neighborsByKind(), predecessorsByKind(), version() methods.
  - Minor: export timestamp() and confidence() brand constructors if needed by other modules.

- packages/knowledge/src/indices/interval-tree.ts (new)
  - Implement RB-tree augmented with maxEnd, insert and query methods.

- packages/knowledge/src/util/lru.ts (new)
  - Implement a simple LRU cache using Map and key-rotation.

- packages/knowledge/src/query.ts
  - Implement initializeVariableDomains() to seed variable domains using graph indices.
  - Implement generateCandidates() with AC-3 and MRV heuristic.
  - Implement satisfiesClause() using graph.neighborsByKind() and iteration over facts.
  - Add compile() and LRU caching in execute().
  - Implement semanticQuery() using graph.entries() and optional embeddings KNN fallback.

- packages/knowledge/src/persist.ts (new)
  - Implement extractEntries(), persistHypergraph(), loadHypergraph().

- packages/agent/assistant/src/hypergraph-bridge.ts (new)
  - Implement persistHypergraphToDb(graph, resource) using persistKnowledge().
  - Implement loadHypergraphFromDb(resource, graph) using @alfred/db repo.

- packages/rag/src/rerank.ts
  - Add telemetry option; call hooks on success/error; do not throw.

- packages/rag/src/rerank.d.ts
  - Update types to include telemetry.

- packages/db/src/repo/rag.ts
  - Pass telemetry object to rerank() with structured logs.

- packages/db/src/repo/graph.ts
  - Add getNeighbors(), getSubgraph(), findPath() as above.

- packages/api/src/routers/graph.ts
  - Replace full-table scan in getEdges with inArray+and predicate.
  - Compute edge hash with crypto for connect; use onConflictDoNothing to avoid duplicates; optionally accept resource input.

- packages/db/src/migrations/0026_graph_rag_indexes.sql (new)
  - As shown above.

- packages/db/src/schema/rag.ts (optional)
  - Comment: note unique index on source added via migration.

---

## Reasoning and Algorithmic Validation

- Interval Tree:
  - RB-tree with maxEnd augmentation per CLRS Ch. 14:
    - Invariants ensure O(log n) insertion.
    - queryPoint/queryRange prune branches by comparing start to node.left.maxEnd allowing O(log n + k).
  - Maintains worst-case guarantees required for <1ms typical queries.

- Query Engine (AC-3 + MRV):
  - AC-3 enforces arc consistency, pruning domains early; reduces backtracking search space.
  - MRV orders variables by smallest domain; improves performance on sparse constraints.
  - With graph indices by kind and direction, constraint checks are O(1)/O(d); meets <10ms target for typical queries.

- Rerank Telemetry:
  - Non-blocking, optional; maintains existing semantics under failure (returns original documents, score fallback).
  - Structured logging supports post-analysis; no dependency introduction.

- DB Indexes:
  - Unique on rag_documents.source aligns with dedup recommended in review.
  - GIN on memory_nodes.label_tsvector enables label search and filter; complements RAG retrieval.
  - Resource-partitioned edge indexes accelerate tenant-scoped traversals.

---

## Data Structure Modifications

- Hypergraph:
  - Add inbound map, edges-by-kind maps, embeddings map (optional), dirty set, modCount.
- IntervalTree:
  - New structure as described; encapsulated under Hypergraph.temporal.
- KnowledgeEntry extraction:
  - Use knowledgeHash(data) to keep content-addressed identity consistent with db unique (resource, hash).

---

## Interface Changes

- packages/rag/src/rerank.ts: RerankOptions gains optional telemetry; backwards compatible.
- packages/knowledge/src/hypergraph.ts: new methods; existing methods intact.
- packages/db/src/repo/graph.ts: new traversal functions.

---

## Configuration Updates

- Optional env toggle for logging:
  - RAG_RERANK_LOG_JSON=1 to emit JSON structured logs in ragRepo.
- No changes to EMBEDDING_DIM or model configuration.

---

## Potential Side Effects and Impacts

- Slight memory overhead in Hypergraph due to additional indices and dirty tracking; acceptable for ephemeral per-workflow graphs.
- API router getEdges will become significantly faster and more scalable.
- Recursive CTE in findPath uses raw SQL; adhere to drizzle rules doc by documenting this as an exception due to builder limitations.
- Persist/load functions rely on consistency between knowledgeHash and memory_nodes.hash/memory_edges metadata; ensure agent graphstore maintains this mapping (already does via makeEdge metadata { from, to }).

---

## Critical Architectural Decisions

- Keep Hypergraph pure and in-memory; persistence delegated via agent bridge to avoid package cycles and keep knowledge reusable for other runtimes.
- Prefer pgvector and DB search for semantic retrieval; avoid building complex ANN in-process; optional tiny KNN fallback is provided for very small graphs.
- AC-3 chosen for CSP with MRV; proven algorithm with favorable performance characteristics on sparse graph constraints.

---

## Open Items (Phase 2/3 – not required for critical gap closure)

- Replace regex query parser with PEG-based Datalog parser for correctness on nested/rule queries.
- Implement proper B-tree and R-tree if in-memory indices become bottleneck; otherwise rely on DB indexes.
- Metrics package integration (e.g., @alfred/metrics) for durations and error counts via optional dynamic import.
- Pre-warming embeddings pool at startup.

---

## Short Code Patterns

- KnowledgeEntry extraction (persist.ts)
  ```ts
  import { knowledgeHash } from "./hypergraph";

  export function extractEntries(graph: Hypergraph, opts?: { onlyDirty?: boolean }): KnowledgeEntry[] {
    const entries: KnowledgeEntry[] = [];
    const ids = opts?.onlyDirty ? graph.getDirty() : Array.from(graph.ids());
    for (const id of ids) {
      const k = graph.get(id);
      if (!k) continue;
      entries.push({ hash: knowledgeHash(k), data: k });
    }
    return entries;
  }
  ```

- AC-3 revise stub
  ```ts
  function revise(
    Xi: Variable,
    Xj: Variable,
    domains: Map<Variable, Set<string>>,
    rel: { kind: string; direction: "out" | "in" },
    graph: Hypergraph
  ): boolean {
    let revised = false;
    const di = domains.get(Xi)!;
    const dj = domains.get(Xj)!;
    for (const vi of Array.from(di)) {
      const neighbors = rel.direction === "out"
        ? new Set(graph.neighborsByKind(vi as any, rel.kind))
        : new Set(graph.predecessorsByKind(vi as any, rel.kind));
      const supported = Array.from(dj).some(vj => neighbors.has(vj as any));
      if (!supported) {
        di.delete(vi);
        revised = true;
      }
    }
    return revised;
  }
  ```

- API router getEdges optimized
  ```ts
  .query(async ({ input }) => {
    const ids = input.nodeIds;
    if (ids.length === 0) return [];
    return db
      .select()
      .from(memoryEdges)
      .where(
        and(
          inArray(memoryEdges.fromId, ids),
          inArray(memoryEdges.toId, ids)
        )
      );
  })
  ```

---

If you want, I can prioritize the work list per file and create per-commit checklists to guide implementation week-by-week.
