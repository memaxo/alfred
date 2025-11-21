# ALFRED Graph Architecture Unification: Implementation Plan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

This plan addresses the critical gaps identified in docs/reviews/graph-architecture-review.md and organizes implementation into five phases. The database graph remains the system of record; the hypergraph is the in-memory compute layer; mindscape is the view. We introduce a unified graph layer for identifiers and sync.

After implementation, users will have:
- Production-ready spatial and ordered indices enabling fast graph queries
- Automatic persistence of hypergraph changes to the database with optional embedding computation
- Unified identifier mapping between UI nodes, database records, and hypergraph hashes
- Bidirectional synchronization between mindscape canvas and database graph
- Semantic layout visualization using embeddings and relationships
- A unified query interface that routes queries to the appropriate backend (DB graph, hypergraph, or RAG)

Each change lists files, code locations, APIs, and side effects.

## Progress

- [x] (2025-11-21 00:48Z) Phase 1A: Implemented production-ready N-dimensional RTree (1024D)
- [x] (2025-11-21 00:50Z) Phase 1B: Implemented production-ready BTree ordered index
- [x] (2025-11-21 00:51Z) Phase 1C: Added database graph traversal indexes migration
- [x] (2025-11-21 00:58Z) Phase 2A: Implemented auto-persist with dirty tracking
- [x] (2025-11-21 00:58Z) Phase 2B: Wired bridge auto-sync with embedding support
- [x] (2025-11-21 00:58Z) Phase 2C: Removed embedding TODOs and wired spatial index
- [ ] Phase 3A: Create unified graph types and ID mapping
- [ ] Phase 3B: Implement mindscape edge persistence (Mindscape → DB)
- [ ] Phase 3C: Add node data mapping for mindscape nodes
- [ ] Phase 3D: Implement robust edge mapping in initializer (DB → Mindscape)
- [ ] Phase 3E: Add graph edge subscription for live updates
- [ ] Phase 4A: Implement semantic layout using relationships/embeddings
- [ ] Phase 4B: Create knowledge node visualization component
- [ ] Phase 5A: Implement query planner across DB graph, Hypergraph, and RAG
- [ ] Phase 5B: Add unified API endpoints

## Surprises & Discoveries

- Observation: Direct hypervolume calculations in 1024 dimensions quickly underflow/overflow, so the RTree uses log1p-based span measures to pick seeds and compute enlargement reliably.
  Evidence: packages/knowledge/src/indices/rtree.ts (measure/enlargement helpers).
- Observation: `bun run db:migrate` fails locally because Drizzle's `meta/_journal.json` is missing in packages/db, so migrations cannot be replayed without additional setup.
  Evidence: CLI error "Error: Can't find meta/_journal.json file" from drizzle-kit migrate.
- Observation: `bun test` currently fails before finishing due to Playwright suites being invoked from plain `.spec.ts` files (error: "Playwright Test did not expect test.describe() to be called here") and an unrelated timeout in `packages/runtime/test/observability.test.ts`.
  Evidence: bun test stack traces for apps/web/tests/mindscape.* and packages/runtime/test/observability.test.ts.

## Decision Log

_This section will be updated as key decisions are made during implementation._

- Decision: Remove feature flags from implementation
  Rationale: Following workspace rules that prohibit feature flags for core functionality. All features will be enabled by default.
  Date/Author: 2025-01-27

- Decision: Remove legacy code maintenance paths
  Rationale: Following workspace rules that require deleting old code paths instead of maintaining parallel implementations.
  Date/Author: 2025-01-27

- Decision: Use logarithmic span metrics for RTreeND area/enlargement heuristics
  Rationale: Prevents floating-point underflow/overflow when comparing 1024-dimensional rectangles while keeping insertion heuristics stable.
  Date/Author: 2025-11-21 / Codex

- Decision: Rebuild BTreeIndex on delete operations to keep balancing guarantees without complex in-place rebalancing
  Rationale: Deletes are rare compared to inserts; rebuilding from existing entries keeps the tree valid while keeping the implementation simple and predictable.
  Date/Author: 2025-11-21 / Codex

- Decision: Keep embeddings in-memory only and skip dirty flags when graph.setEmbedding runs
  Rationale: Embeddings serve spatial queries but do not need to be persisted yet; avoiding dirty flags prevents endless persist cycles triggered by auto-embedder.
  Date/Author: 2025-11-21 / Codex

## Outcomes & Retrospective

- Phase 1 (2025-11-21 00:51Z): Hypergraph now uses production-ready RTree and BTree indices with dedicated unit tests, and Postgres ships traversal-focused indexes (0035) to keep getNeighbors/findPath queries fast; pending validation confirms Phase 1 acceptance.
- Phase 2 (2025-11-21 00:58Z): Auto-persist now runs on a timer with optional embedding batches, the assistant bridge exposes startHypergraphSync(), and embeddings stay resident-only, clearing TODO debt around the spatial index.

---

## Context and Orientation

This plan unifies three graph representations in ALFRED:

1. **Database graph** (`packages/db/src/schema/graph.ts`): Persistent Postgres tables `memory_nodes` and `memory_edges` storing facts, relations, and UI artifacts. Accessed via `packages/db/src/repo/graph.ts` repository functions.

2. **Hypergraph** (`packages/knowledge/src/hypergraph.ts`): In-memory knowledge graph with HAMT-based node storage, currently using stub RTree (1D) and array-based BTree. Provides fast pattern matching and semantic queries via `packages/knowledge/src/query.ts`.

3. **Mindscape** (`apps/web/src/components/mindscape/`): React Flow canvas for visualizing and editing graph nodes. Stores UI state in `apps/web/src/store/mindscape.ts` with localStorage persistence.

The current architecture has gaps:
- Hypergraph uses placeholder indices that don't scale
- No automatic persistence from hypergraph to database
- No unified identifier mapping between UI nodes, DB records, and hypergraph hashes
- Mindscape edges created in UI don't persist to database
- Edge mapping relies on fragile string suffix matching

This plan introduces a unified graph layer (`packages/graph/`) that provides identifier mapping and query routing, enabling seamless synchronization between all three representations.

Key files to understand:
- `packages/knowledge/src/hypergraph.ts`: Core hypergraph implementation with current stub indices
- `packages/knowledge/src/persist.ts`: Current persistence logic (manual calls)
- `packages/agent/assistant/src/hypergraph-bridge.ts`: Bridge between agent and hypergraph
- `apps/web/src/components/mindscape/canvas.tsx`: React Flow canvas with edge creation
- `apps/web/src/components/mindscape/initializer.tsx`: Syncs database edges to mindscape
- `packages/api/src/routers/graph.ts`: tRPC endpoints for graph operations

---

## Phase 1 — Critical Index Implementations (BLOCKING)

### 1A. Production-ready N-Dimensional RTree (1024D)

- New file: packages/knowledge/src/indices/rtree.ts
- Replace the 1D stub in hypergraph.ts (lines ~109–130) with a proper multi-dimensional R-tree implementation (Guttman’s quadratic split).
- Ensure EXACT 1024-dimension vectors are enforced by default.

Key types and signatures:
```ts
// packages/knowledge/src/indices/rtree.ts
import type { NodeId } from "../hypergraph";

export type HyperRect = { min: Float32Array; max: Float32Array };

export class RTreeND {
  constructor(
    readonly dim: number = 1024,
    readonly maxEntries: number = 64,
    readonly minEntries: number = Math.floor(64 * 0.4)
  ) {}

  // Insert a single point; internally wrapped as a zero-volume MBR
  insertPoint(vec: Float32Array, id: NodeId): void;

  // Insert/update an MBR explicitly
  insert(rect: HyperRect, id: NodeId): void;

  // Axis-aligned range search; returns NodeIds whose MBR intersects rect
  search(rect: HyperRect): NodeId[];

  // Optional: k-NN based on L2 distance to point center
  nearestK(point: Float32Array, k: number): Array<{ id: NodeId; dist: number }>;

  // Optional: remove id (needed if embeddings are updated)
  remove(id: NodeId): boolean;
}
```

Integration in hypergraph:
- File: packages/knowledge/src/hypergraph.ts
  - Replace the internal class RTree with import: `import { RTreeND } from "./indices/rtree.js";`
  - Instantiate with fixed dim 1024: `private readonly spatial = new RTreeND(1024);`
  - Update setEmbedding to insert into RTree:
    ```ts
    setEmbedding(id: NodeId, vector: Float32Array): void {
      if (vector.length !== 1024) {
        throw new Error("embedding_dim_mismatch_1024");
      }
      // Optional: remove previous index if re-setting
      this.embeddings.set(id, vector);
      this.spatial.insertPoint(vector, id);
      this.dirty.add(id);
      this.modCount++;
    }
    ```
- Side effects:
  - Memory: RTree index additional overhead proportional to number of embedded nodes.
  - Dimension strictly enforced: non-1024-d vectors rejected.
  - KNN in knowledge/query.ts still uses knn() on graph.embeddingEntries(); RTree provides range/neighbors for future enhancements.

Critical decisions:
- RTree is used for axis-aligned range queries and optional nearest; knn.ts remains the baseline for exact KNN to keep query performance predictable.
- Do not call embeddings from hypergraph.add; keep causal direction outside to prevent cross-package coupling.

### 1B. Production-ready BTree (ordered index)

- New file: packages/knowledge/src/indices/btree.ts
- Replace the array-based BTree (lines ~133–158) with real B-tree supporting O(log n) operations and node splitting.

Key types and signatures:
```ts
// packages/knowledge/src/indices/btree.ts
import type { NodeId } from "../hypergraph";

export class BTreeIndex<K = string, V = NodeId> {
  constructor(
    readonly order = 64, // branching factor
    readonly compare: (a: K, b: K) => number = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  ) {}

  insert(key: K, value: V): void;

  // Returns values with start <= key <= end
  range(start: K, end: K): V[];

  // Optional helpers
  get(key: K): V[]; // duplicates allowed
  delete(key: K, value?: V): boolean;
}
```

Integration in hypergraph:
- File: packages/knowledge/src/hypergraph.ts
  - Replace internal BTree class with import: `import { BTreeIndex } from "./indices/btree.js";`
  - Instantiate: `private readonly ordered = new BTreeIndex<string, NodeId>(64);`
  - On fact add: `this.ordered.insert(k.content, nodeRef);`
  - Maintain same API: `search(pattern: string)` → `this.ordered.range(pattern, pattern + "\xFF");`
- Side effects:
  - Slightly higher constant factors vs array splice; asymptotically better at scale.
  - Keys are strings; preserve same semantics used by search().

### 1C. Database graph traversal indexes (migration)

- New migration: packages/db/src/migrations/00XX_graph_indexes.sql
- Update schema TODO comments (packages/db/src/schema/graph.ts) to reflect implemented indexes.

Migration SQL content:
```sql
-- packages/db/src/migrations/00XX_graph_indexes.sql
-- Graph traversal performance indexes

CREATE INDEX IF NOT EXISTS memory_edges_from_kind_idx ON memory_edges (from_id, kind);
CREATE INDEX IF NOT EXISTS memory_edges_to_kind_idx ON memory_edges (to_id, kind);
CREATE INDEX IF NOT EXISTS memory_edges_kind_idx ON memory_edges (kind);

-- Optional: frequently filtered by resource as well
CREATE INDEX IF NOT EXISTS memory_edges_from_kind_resource_idx ON memory_edges (from_id, kind, resource);
CREATE INDEX IF NOT EXISTS memory_edges_to_kind_resource_idx ON memory_edges (to_id, kind, resource);
```

Notes:
- SQLite tests ignore these; Postgres only.
- No schema code change required beyond updating TODO comments in packages/db/src/schema/graph.ts.

---

## Phase 2 — Automatic Persistence & Embedding Indexing

### 2A. Auto-persist with dirty tracking (background worker)

- File change: packages/knowledge/src/persist.ts
- Add a lightweight auto-persist supervisor.

New APIs:
```ts
// packages/knowledge/src/persist.ts
export type AutoPersistOptions = {
  intervalMs?: number;         // default: 5000
  batchSize?: number;          // default: 100
  computeEmbeddings?: boolean; // default: true
  embedBatchSize?: number;     // default: 50
  onError?: (err: unknown) => void;
  embedder?: {
    embed: (text: string) => Promise<Float32Array>;
    embedMany?: (texts: string[]) => Promise<Float32Array[]>;
  };
  // Provide a selector for candidate nodes to embed
  isEmbeddable?: (k: Knowledge) => boolean; // default: facts only
};

export type AutoPersistHandle = {
  stop(): void;
  flush(): Promise<void>;
};

export function startAutoPersist(
  graph: Hypergraph,
  resource: string,
  persistFn: PersistFn,
  options?: AutoPersistOptions
): AutoPersistHandle;
```

Behavior:
- Every intervalMs, call persistHypergraph(graph, resource, persistFn).
- If computeEmbeddings = true:
  - Scan up to batchSize nodes that are (a) facts, (b) missing embeddings, (c) not yet processed.
  - Compute embeddings using embedder.embedMany if available, else embed in a loop.
  - Call graph.setEmbedding(id, vector) for each; this indexes into RTree automatically.
  - Do not mark dirty when embedding if you want to avoid persistence loop; if embedding should be persisted, set a policy: embeddings are in-memory only (recommended). If persistence is desired, persist metadata in DB via properties in memory_nodes; that’s out-of-scope and can be added later.

Side effects:
- Adds a background setInterval; ensure handle.stop() on shutdown to avoid leaks.
- Embedding computation could be CPU/GPU heavy; control via embedBatchSize.

### 2B. Bridge auto-sync wiring

- File change: packages/agent/assistant/src/hypergraph-bridge.ts
- Add start/stop auto-sync that uses persistKnowledge and embedder from @alfred/embed.

New APIs:
```ts
// packages/agent/assistant/src/hypergraph-bridge.ts
import { startAutoPersist, type AutoPersistHandle } from "@alfred/knowledge/persist";
import { embed as embedVec } from "@alfred/embed"; // returns number[]

export type HypergraphSyncOptions = {
  intervalMs?: number;
  computeEmbeddings?: boolean; // default true
  maxPerTick?: number;
};

export function startHypergraphSync(
  resource: string,
  graph: Hypergraph,
  options?: HypergraphSyncOptions
): AutoPersistHandle {
  const handle = startAutoPersist(graph, resource, persistKnowledge, {
    intervalMs: options?.intervalMs ?? 5000,
    computeEmbeddings: options?.computeEmbeddings ?? true,
    embedBatchSize: options?.maxPerTick ?? 32,
    embedder: {
      embed: async (text) => {
        const arr = await embedVec(text);
        return Float32Array.from(arr);
      },
    },
  });
  return handle;
}
```

- Side effects:
  - Requires DATABASE_URL to be set (persistKnowledge early-returns otherwise).
  - @alfred/embed initialization happens on first call.

### 2C. Remove TODO and wire embedding index

- File: packages/knowledge/src/hypergraph.ts
  - Remove in-code TODO comments about embeddings.
  - No direct call to embed(); embedding flows through auto-persist handle and setEmbedding().

---

## Phase 3 — Unified Graph Layer and Bidirectional Sync

### 3A. Unified graph types and ID mapping

- New package: packages/graph/
- New file: packages/graph/src/unified.ts
- New file: packages/graph/src/mapper.ts

Unified types:
```ts
// packages/graph/src/unified.ts
export type UnifiedNodeKind = "fact" | "insight" | "pattern" | "relation" | "ui" | "workflow" | "note" | "reminder" | "ticket" | "code" | "artifact" | "other";

export type UnifiedNodeRef = {
  uiId?: string;             // React Flow node id
  dbId?: string;             // memory_nodes.id (UUID)
  hgHash?: string;           // knowledgeHash (string)
};

export type UnifiedNode = {
  id: UnifiedNodeRef;
  kind: UnifiedNodeKind;
  label: string;
  properties?: Record<string, unknown>;
};

export type UnifiedEdge = {
  id?: string;             // memory_edges.id
  source: UnifiedNodeRef;
  target: UnifiedNodeRef;
  kind: string;
  weight?: number;
  properties?: Record<string, unknown>;
};

export type ResourceScope = string; // e.g., user/workspace
```

Mapping service:
```ts
// packages/graph/src/mapper.ts
import type { UnifiedNodeRef } from "./unified";

export type MappingRecord = {
  uiId?: string;
  dbId?: string;
  hgHash?: string;
};

export class GraphIdMapper {
  // in-memory cache; optionally back this with DB properties if needed
  private ui2db = new Map<string, string>();
  private ui2hash = new Map<string, string>();
  private db2hash = new Map<string, string>();
  private hash2db = new Map<string, string>();
  // … additional maps as needed

  link(ref: MappingRecord): void;
  toDbId(ref: UnifiedNodeRef): string | undefined;
  toHash(ref: UnifiedNodeRef): string | undefined;
  toUiId(ref: UnifiedNodeRef): string | undefined;
}
```

Side effects:
- Internal cache only; persistence of mappings can be added later (e.g., memory_nodes.properties.uiNodeId).

### 3B. Mindscape edge persistence (Mindscape → DB)

- File change: apps/web/src/components/mindscape/canvas.tsx
- Wrap the existing onConnect to both update local store and persist to DB via tRPC graph.connect.

Add wrapper:
```tsx
// apps/web/src/components/mindscape/canvas.tsx (inside MindscapeCanvasInner)
const { mutateAsync: connectEdge } = trpc.graph.connect.useMutation();

const onConnectPersisting = useCallback<OnConnect>(
  async (connection) => {
    // keep existing local behavior
    onConnect(connection);

    try {
      // resolve dbId mapping from nodes' data metadata (added in 3C)
      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);
      const fromId = sourceNode?.data?.graph?.dbId ?? sourceNode?.id;
      const toId = targetNode?.data?.graph?.dbId ?? targetNode?.id;

      await connectEdge({
        fromId,
        toId,
        kind: "relates_to",
        resource: "user", // or scoped from session/workspace
      });
    } catch (err) {
      // optional: reconcile local edge if DB write failed
      console.warn("graph.connect failed", err);
    }
  },
  [onConnect, nodes, connectEdge]
);

// Pass wrapper
<ReactFlow onConnect={onConnectPersisting} ... />
```

Side effects:
- Requires node.data to carry dbId mapping (see 3C).
- On error, local edge and DB diverge; UI can tolerate or revert.

### 3C. Node data mapping for mindscape nodes

- File change: apps/web/src/store/mindscape.ts
- Extend ArtifactData to carry mapping for DB and hypergraph:
  - Add an optional `graph?: { dbId?: string; hgHash?: string }` to all node data schemas (mindscape.schemas). This is an interface change; update zod schemas accordingly.

Example schema patch (pseudo):
```ts
// apps/web/src/store/mindscape.schemas.ts (not included in listing; adapt each node schema)
const graphMappingSchema = z.object({
  dbId: z.string().uuid().optional(),
  hgHash: z.string().optional(),
}).optional();

// e.g., chatNodeDataSchema.extend({ graph: graphMappingSchema })
```

Store updateArtifactData should allow merging of graph mapping:
```ts
updateArtifactData(nodeId, data) {
  // (existing)
  // ensure graph: { ...existing, ...incoming }
}
```

Side effects:
- Persist middleware includes nodes; mapping persisted to localStorage.
- Backward-compatible (graph field optional).

### 3D. Robust edge mapping in initializer (DB → Mindscape)

- File change: apps/web/src/components/mindscape/initializer.tsx
- Replace fragile endsWith(dbId) mapping with data.graph.dbId.

Patch:
```tsx
// inside Sync Edges effect
const findNodeIdByDbId = (dbId: string) => {
  const node = useMindscapeStore.getState().nodes.find(n => n.data?.graph?.dbId === dbId);
  return node?.id ?? null;
};

const newEdges = edges.map((edge: GraphEdge) => {
  const source = findNodeIdByDbId(edge.fromId) ?? `note-${edge.fromId}`;
  const target = findNodeIdByDbId(edge.toId) ?? `note-${edge.toId}`;
  return { id: edge.id, source, target, animated: true, style: { stroke: "rgba(255,255,255,0.2)" } };
});
```

Side effects:
- Requires nodes to populate graph.dbId on creation/hydration.
- Fallbacks preserved for nodes not yet loaded.

### 3E. Graph edge subscription (DB → Mindscape live updates)

- File change: packages/api/src/routers/graph.ts
- Add a subscription that periodically polls edges for a set of db nodeIds and emits deltas.

New procedure:
```ts
// packages/api/src/routers/graph.ts
const edgeWatchInput = z.object({
  nodeIds: z.array(z.string()).min(1),
  resource: z.string().optional(),
  pollMs: z.number().int().min(500).max(30000).default(3000),
});

watchEdges: authedProcedure.input(edgeWatchInput).subscription(({ input, ctx }) =>
  observable<{ edges: typeof memoryEdges.$inferSelect[] }>((emit) => {
    let cancelled = false;
    let lastIds = new Set<string>();

    const tick = async () => {
      if (cancelled) return;
      const edges = await db.select().from(memoryEdges).where( /* same filter as getEdges */ );
      const ids = new Set(edges.map(e => e.id));
      // simple diff
      const changed = edges.filter(e => !lastIds.has(e.id));
      if (changed.length > 0) emit.next({ edges: changed });
      lastIds = ids;
      setTimeout(tick, input.pollMs);
    };
    tick();

    return () => { cancelled = true };
  })
),
```

Web usage:
- File change: apps/web/src/components/mindscape/initializer.tsx
- Add trpc.graph.watchEdges.useSubscription({ nodeIds, resource }, { onData: append to setEdges with merge-dedupe })

Side effects:
- Polling-based; upgrade to DB logical decoding/webhooks later.
- Minimal server load; controlled by pollMs.

---

## Phase 4 — Semantic Layout and Knowledge Visualization

### 4A. Semantic layout using relationships/embeddings

- New file: apps/web/src/lib/layout-semantic.ts
- Strategy:
  - Start from current concentric layout as baseline.
  - If embeddings are available (node.data.graph.hgHash → fetch embedding via unified layer; or provide as node.data.graph.embedding later), perform a force-directed layout:
    - Attractive edges along DB graph edges and knowledge relations.
    - Repulsive forces between unconnected nodes.
    - Seed positions from concentric layout; run N iterations (e.g., 200) or time budget (16ms/frame) in a Web Worker (optional).
  - Preserve user-dragged positions (lock).
  - Recompute incrementally for changed nodes only (dirty set).

API:
```ts
// apps/web/src/lib/layout-semantic.ts
import type { Node, Edge } from "@xyflow/react";
import type { ArtifactData } from "@/store/mindscape";

export type SemanticLayoutOptions = {
  anchorId?: string;         // "singularity"
  iterations?: number;       // default 200
  stiffness?: number;        // spring constant
  repulsion?: number;        // Coulomb constant
  gravity?: number;          // pull to center
  respectPinned?: boolean;   // default true
};

export function layoutSemantic(
  nodes: Node<ArtifactData>[],
  edges: Edge[],
  options?: SemanticLayoutOptions
): Node<ArtifactData>[];
```

- File change: apps/web/src/lib/layout.ts
  - Export both getLayoutedElements (baseline) and a new getSemanticLayoutedElements wrapper that delegates to layoutSemantic when enabled.

Side effects:
- Optional dependency on a small force simulation library (e.g., d3-force). If added, update apps/web package.json.

### 4B. Knowledge node visualization

- New component: apps/web/src/components/mindscape/nodes/knowledge-node.tsx
- Purpose: Render hypergraph-derived nodes (fact/insight/pattern) when needed.

Signature:
```tsx
// knowledge-node.tsx
import type { NodeProps } from "@xyflow/react";
export function KnowledgeNode({ id, data, selected }: NodeProps) {
  // display label, kind, confidence/accuracy badges
}
```

- File change: apps/web/src/components/mindscape/canvas.tsx
  - Register node type: knowledge: wrapWithErrorBoundary(KnowledgeNode)

- Side effects:
  - Requires injection of knowledge nodes into mindscape; tie-in via unified layer in future iterations.

---

## Phase 5 — Unified Query Interface

### 5A. Query planner across DB graph, Hypergraph, and RAG

- New file: packages/graph/src/query.ts
- Define a planner that routes:
  - Traversal/path queries to DB (graphRepo.*)
  - Datalog pattern queries to Hypergraph (knowledge/query.execute)
  - Semantic queries to RAG (rag.retrieve) or Hypergraph KNN if embeddings available
  - Merge results and deduplicate with mapping

API:
```ts
// packages/graph/src/query.ts
import type { Hypergraph } from "@alfred/knowledge/hypergraph";
import * as graphRepo from "@alfred/db/repo/graph";
import { execute as hgExecute, parse as hgParse, semanticQuery as hgSemantic } from "@alfred/knowledge/query";
import { retrieve as ragRetrieve } from "@alfred/rag";

export type QueryKind = "traverse" | "path" | "datalog" | "semantic";

export type UnifiedQuery =
  | { kind: "traverse"; nodeId: string; direction?: "in" | "out" | "both"; resource?: string; }
  | { kind: "path"; fromId: string; toId: string; maxDepth?: number; resource?: string; }
  | { kind: "datalog"; query: string; }
  | { kind: "semantic"; text: string; topK?: number; preferRag?: boolean; };

export type UnifiedQueryResult = { nodes: UnifiedNode[]; edges?: UnifiedEdge[] };

export async function runQuery(
  q: UnifiedQuery,
  context: { graph?: Hypergraph; resource?: string }
): Promise<UnifiedQueryResult>;
```

Planner logic (high-level):
- traverse → graphRepo.getNeighbors + normalize to UnifiedNode/UnifiedEdge
- path → graphRepo.findPath
- datalog → hgExecute(hgParse(q.query), context.graph!)
- semantic → if context.graph has embeddings → hgSemantic; else ragRetrieve

Side effects:
- Introduces dependency from unified layer to db/repo, knowledge/query, rag. Acceptable for orchestration layer (packages/graph).

### 5B. Unified API endpoints (optional initial wiring)

- File change: packages/api/src/routers/graph.ts
- Add a new query endpoint:
  ```ts
  runQuery: authedProcedure
    .input(z.object({ q: z.any() })) // strongly type with zod for UnifiedQuery
    .query(async ({ input }) => {
      const { runQuery } = await import("@alfred/graph/src/query");
      const result = await runQuery(input.q, { /* graph: optional in-memory handle */ });
      return result;
    }),
  ```
- Side effects:
  - For initial cut, only DB queries will be wired server-side unless a shared in-memory hypergraph instance is available in API process.

---

## Cross-Cutting Changes

### Hypergraph class updates (imports and fields)

- File: packages/knowledge/src/hypergraph.ts
  - Replace local RTree and BTree classes with imports.
  - Keep public API unchanged. New internal fields:
    - spatial: RTreeND
    - ordered: BTreeIndex<string, NodeId>
  - setEmbedding now indexes into spatial index.

Potential impacts:
- serialization or introspection of internal types is unaffected.
- Code relying on query.search() or embeddingEntries() works unchanged.

### Mindscape schemas to store mapping

- File(s): apps/web/src/store/mindscape.schemas.ts (not in listing)
  - Add optional `graph` field to all node schemas:
    ```ts
    graph: z.object({
      dbId: z.string().uuid().optional(),
      hgHash: z.string().optional(),
    }).optional()
    ```
- File: apps/web/src/store/mindscape.ts
  - updateArtifactData merges nested graph mapping if present.

### TRPC graph router extensions

- File: packages/api/src/routers/graph.ts
  - Add watchEdges subscription (polling).
  - Keep existing getEdges and connect endpoints.

### Configuration

- New environment flags:
  - KNOWLEDGE_SYNC_INTERVAL_MS (default 5000)
  - KNOWLEDGE_EMBEDDINGS_ENABLED (default true)
- Where used:
  - startHypergraphSync() → intervalMs, computeEmbeddings from env

---

## Side Effects and Architectural Decisions

- Source of Truth: Database graph is the persistent source of truth; hypergraph is an in-memory compute/cache. Mindscape is a view layer backed by SoT via subscriptions.
- Embeddings: Stored in-memory in hypergraph; not persisted to DB initially to avoid schema coupling. Future: persist compressed or hashed embeddings if needed.
- ID Collisions: Resolved via unified GraphIdMapper and explicit mapping fields in node data. Avoid relying on string suffix matching.
- RTree vs HNSW: RTree implemented for MBR/range and optional nearest; KNN remains exact via cosine similarity (knowledge/indices/knn.ts). HNSW can be considered later for >1e5 nodes if needed.
- Large graphs: Semantic layout is opt-in and incremental. For very large graphs, limit layout to viewport and neighbors-of-neighbors.
- Versioning: Hypergraph already tracks modCount; DB versioning can be approximated via created timestamps and migration-managed schema. A formal version vector is out-of-scope for this iteration.

---

## File-by-File Change List

1. packages/knowledge/src/indices/rtree.ts
   - New production RTreeND (1024D), quadratic split, insert/search/nearest.

2. packages/knowledge/src/indices/btree.ts
   - New BTreeIndex with node splitting, insert, range, (optional delete/get).

3. packages/knowledge/src/hypergraph.ts
   - Replace internal RTree/BTree with imports.
   - Instantiate RTreeND(1024), BTreeIndex(64).
   - Update setEmbedding() to index into RTree.

4. packages/knowledge/src/persist.ts
   - Add startAutoPersist(graph, resource, persistFn, options) API.
   - Implement periodic persist and optional embedding computation.

5. packages/agent/assistant/src/hypergraph-bridge.ts
   - Add startHypergraphSync(resource, graph, options) that wires persistKnowledge and @alfred/embed.

6. packages/db/src/migrations/00XX_graph_indexes.sql
   - Add traversal indexes for memory_edges.

7. packages/db/src/schema/graph.ts
   - Update TODO comments to reflect the new indexes (no code change required).

8. packages/graph/src/unified.ts (new)
   - Define UnifiedNode/Edge/Ref types and ResourceScope.

9. packages/graph/src/mapper.ts (new)
   - Implement GraphIdMapper for id mapping between UI/DB/Hypergraph.

10. packages/graph/src/query.ts (new)
    - Implement runQuery planner across DB graph, hypergraph, and RAG.

11. packages/api/src/routers/graph.ts
    - Add watchEdges subscription (polling).
    - Optional: add runQuery endpoint delegating to unified layer.

12. apps/web/src/store/mindscape.schemas.ts
    - Extend node schemas to include optional graph mapping.

13. apps/web/src/store/mindscape.ts
    - Merge graph mapping in updateArtifactData; keep partial validation.

14. apps/web/src/components/mindscape/canvas.tsx
    - Wrap onConnect to also call trpc.graph.connect.
    - Pass wrapper to ReactFlow.

15. apps/web/src/components/mindscape/initializer.tsx
    - Change edge mapping to use node.data.graph.dbId instead of endsWith().
    - Add optional subscription to trpc.graph.watchEdges to merge-in live edges.

16. apps/web/src/lib/layout-semantic.ts (new)
    - Implement semantic force-based layout API.

17. apps/web/src/components/mindscape/nodes/knowledge-node.tsx (new)
    - Render knowledge nodes (fact/insight/pattern) with badges.

---

## Example Interfaces and Snippets

- startAutoPersist in persist.ts
```ts
export function startAutoPersist(
  graph: Hypergraph,
  resource: string,
  persistFn: PersistFn,
  opts: AutoPersistOptions = {}
): AutoPersistHandle {
  const {
    intervalMs = 5000,
    computeEmbeddings = true,
    embedBatchSize = 32,
    onError,
    embedder,
    isEmbeddable = (k) => k._ === "fact",
  } = opts;

  let timer: any = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      await persistHypergraph(graph, resource, persistFn);
      if (computeEmbeddings && embedder) {
        // embed up to embedBatchSize facts missing embeddings
        const todo: Array<{ id: NodeId; content: string }> = [];
        for (const [id, k] of graph.entries()) {
          if (todo.length >= embedBatchSize) break;
          if (!isEmbeddable(k)) continue;
          if (graph.getEmbedding(id)) continue;
          todo.push({ id, content: k._ === "fact" ? k.content : "" });
        }
        if (todo.length) {
          if (embedder.embedMany) {
            const vecs = await embedder.embedMany(todo.map(t => t.content));
            vecs.forEach((v, i) => graph.setEmbedding(todo[i]!.id, v));
          } else {
            for (const t of todo) {
              const v = await embedder.embed(t.content);
              graph.setEmbedding(t.id, v);
            }
          }
        }
      }
    } catch (err) {
      onError?.(err);
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };

  timer = setTimeout(tick, intervalMs);

  return {
    stop() { stopped = true; if (timer) clearTimeout(timer); },
    async flush() { await persistHypergraph(graph, resource, persistFn); },
  };
}
```

- onConnectPersisting wrapper in canvas.tsx (see 3B above).

---

## Risks and Considerations

- RTree correctness: Guttman’s quadratic split is non-trivial; ensure leaf/non-leaf split logic and MBR updates are correct. Use dimension 1024 consistently.
- Embedding workload: Pool and GPU device selection driven by @alfred/embed; throttle embedBatchSize to avoid UI latency.
- Subscription via polling: acceptable interim approach; migrate to event-based in the future.
- Mapping persistence: Keeping mappings only in UI can be lost across devices. Consider writing uiNodeId into memory_nodes.properties in a follow-up migration if needed.
- Web bundle size: If using d3-force, keep bundle impact acceptable; load lazily or move to a Web Worker.

---

## Configuration Updates

- New env flags:
  - KNOWLEDGE_SYNC_INTERVAL_MS=5000
  - KNOWLEDGE_EMBEDDINGS_ENABLED=true
- Hypergraph sync start location:
  - Start in agent bootstrap or wherever a Hypergraph instance is created. For example, in packages/agent entrypoint:
    ```ts
    const handle = startHypergraphSync(resource, graph, {
      intervalMs: Number(process.env.KNOWLEDGE_SYNC_INTERVAL_MS ?? 5000),
      computeEmbeddings: process.env.KNOWLEDGE_EMBEDDINGS_ENABLED !== "false",
    });
    // on shutdown: handle.stop()
    ```

---

## Validation and Acceptance

### Phase 1 Validation

After Phase 1 completion:
- Run `bun test` in `packages/knowledge` and verify all tests pass
- Verify RTree handles 1024-dimensional vectors: create a test that inserts 100 random 1024D vectors and performs range queries
- Verify BTree maintains O(log n) performance: benchmark insert/range operations with 10k entries vs previous array-based implementation
- Run migration: `bun run db:migrate` and verify indexes are created in Postgres (`\d memory_edges` should show new indexes)
- Verify hypergraph.setEmbedding() rejects non-1024D vectors with clear error message

### Phase 2 Validation

After Phase 2 completion:
- Start agent with hypergraph sync enabled and verify logs show periodic persistence
- Add a fact to hypergraph, wait 5 seconds, verify it appears in `memory_nodes` table
- Enable embeddings and verify embeddings are computed and indexed in RTree
- Verify handle.stop() prevents further persistence and embedding computation
- Verify handle.flush() immediately persists all dirty nodes

### Phase 3 Validation

After Phase 3 completion:
- Create an edge in mindscape canvas, verify it appears in `memory_edges` table via `trpc.graph.getEdges`
- Create an edge in database via `trpc.graph.connect`, verify it appears in mindscape canvas
- Verify node.data.graph.dbId mapping persists across page reloads
- Subscribe to `trpc.graph.watchEdges` and verify new edges appear in UI within poll interval
- Verify edge mapping uses data.graph.dbId instead of string suffix matching

### Phase 4 Validation

After Phase 4 completion:
- Load mindscape with nodes that have embeddings, verify semantic layout positions nodes based on relationships
- Verify user-dragged positions are preserved (locked) during layout recomputation
- Verify knowledge nodes render with correct badges and labels
- Test with large graph (100+ nodes) and verify layout completes within acceptable time (<1s)

### Phase 5 Validation

After Phase 5 completion:
- Execute traverse query via `trpc.graph.runQuery` and verify results match direct `graphRepo.getNeighbors` call
- Execute datalog query and verify results match `knowledge/query.execute`
- Execute semantic query and verify results come from appropriate backend (hypergraph KNN or RAG)
- Verify unified query results include proper UnifiedNode/UnifiedEdge structures with ID mappings

### End-to-End Acceptance

1. Start agent with hypergraph sync enabled
2. Add knowledge facts via agent interaction
3. Verify facts appear in database within sync interval
4. Open mindscape canvas and verify facts appear as nodes
5. Create edge between two nodes in mindscape
6. Verify edge persists to database
7. Refresh page and verify edge still exists
8. Execute unified query and verify results span database graph, hypergraph, and RAG

## Idempotence and Recovery

All steps in this plan are idempotent:

- **Migrations**: Use `IF NOT EXISTS` clauses; running migrations multiple times is safe
- **Index creation**: RTree and BTree constructors create empty indices; calling multiple times is safe
- **Auto-persist**: `startAutoPersist` can be called multiple times; each returns a handle that can be stopped independently
- **Node data mapping**: Schema extensions are backward-compatible (optional fields); existing nodes without mapping continue to work
- **Edge persistence**: `trpc.graph.connect` is idempotent (duplicate edges are handled by database constraints)

Recovery procedures:

- **Migration failures**: Rollback via `bun run db:migrate --rollback` if migration fails mid-execution
- **Auto-persist errors**: Errors are logged via `onError` callback; persistence continues on next interval
- **Edge sync divergence**: If UI and DB diverge, refresh page to reload from database (source of truth)
- **Embedding computation failures**: Failed embeddings are skipped; computation continues for remaining nodes on next tick

## Answers to Key Questions (decisions)

1. Single source of truth: Database graph (Postgres). Hypergraph is the cache/compute layer with auto-persist to DB. Mindscape is a view that syncs to/from DB.
2. ID collisions: Avoid by explicit mapping GraphIdMapper and data.graph mapping on nodes; do not infer with string suffixes.
3. HNSW vs RTree: Keep RTree for MBR/range; use exact KNN via cosine for now. Consider HNSW when node count and latency require approximate search.
4. Large graphs: Use semantic layout only for a subgraph (viewport neighborhood), incremental updates, and Web Worker for layout iterations if needed.
5. Versioning: Hypergraph modCount suffices in-memory; DB events timestamp ordering and migrations handle persistence. Full version vectors are out-of-scope.

---

This plan prioritizes index correctness and automatic persistence first, enabling reliable data flow and performance, then layers unified identifiers and bidirectional sync, followed by visualization and unified query APIs.
