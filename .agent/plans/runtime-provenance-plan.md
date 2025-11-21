# Runtime → RAG Provenance ExecPlan (Workflow, Reasoning, and Mindscape Integration)

This ExecPlan is a living document and must be maintained in accordance with `.agent/PLANS.md`. It describes how to wire explicit provenance from runtime workflows that use RAG context into the shared hypergraph/graph substrate, and how to surface that provenance in the graph API and Mindscape UI. A novice should be able to follow this plan, starting from a clean checkout of the repository, and end up with workflows where “this reasoning step came from these RAG documents” is visible and explorable.

## Purpose / Big Picture

From a user’s point of view, the current system can retrieve context from RAG and it can persist reasoning traces into the knowledge graph, but the connection between “which documents were used” and “which reasoning nodes resulted” is implicit. After this ExecPlan is implemented, a user will be able to:

1. Run a workflow that uses RAG context and later inspect, via graph queries or Mindscape, which RAG documents explicitly contributed to specific reasoning steps.
2. See RAG document nodes and reasoning nodes connected by `explains`-style edges in Mindscape, with a distinct visual treatment, so it is obvious how the assistant’s reasoning relates back to ingested knowledge.
3. Query the graph (via the existing `graph.runQuery` API) around a reasoning node and find the linked RAG document nodes without needing to reverse‑engineer log output or raw DB state.

The user-visible behavior is: “When I inspect a reasoning chain in Mindscape or via the graph API, I can see which RAG documents explain each step, and those links are stable and queryable across restarts.”

## Progress

- [x] (2025-11-21 04:40Z) Extended `ExecutionContext` (`packages/runtime/src/context.ts`) to include `ragDocumentIds` derived from RAG chunks, added user-scoped `rag_document` nodes in `packages/rag/src/doc.ts`, and implemented `linkRagProvenanceToReasoning` in `packages/agent/assistant/src/graphstore.ts` plus a unit test (`graphstore-rag-provenance.test.ts`) validating `explains` edges are created correctly.
- [x] (2025-11-21 04:55Z) Updated Mindscape (`apps/web/src/components/mindscape/initializer.tsx` and `knowledge-node.tsx`) to visually distinguish RAG-backed `knowledge` nodes (`source="rag"`) from runtime nodes (`source="runtime"`) and styled `explains` edges as green, dashed connections. Confirmed the Mindscape graph test still passes with DOM shims and mocked tRPC responses.
- [ ] Wire runtime-backed workflows (via `@alfred/runtime` and the `workflow` router) to pass `ExecutionContext.ragDocumentIds` into `persistReasoning` and call `linkRagProvenanceToReasoning` after reasoning persistence.
- [ ] Add an end-to-end provenance smoke test for the workflow runtime path (using sqlite) that exercises: ingest RAG documents → run a minimal workflow → persist reasoning + provenance → inspect `explains` edges via graph queries.
- [ ] Update user-facing docs (`docs/architecture/hypergraph.md` and workflow/runtime docs) to describe how runtime provenance is captured, persisted, and surfaced in Mindscape and the graph API.

## Surprises & Discoveries

- Observation: The RAG enrichment path already had enough information (document ID and source) to create provenance anchor nodes, but runtime reasoning did not yet track which documents were used. The `ExecutionContext` extension to include `ragDocumentIds` was straightforward and required no DB changes.
  Evidence: `packages/runtime/src/context.ts` now derives `ragDocumentIds` from `ragChunks[*].metadata.documentId`.

- Observation: Path aliases used in production imports (`@alfred/agent/assistant/src/hypergraph-bridge`) differ from the package entrypoint (`@alfred/agent`), and Bun’s module resolution in tests is sensitive to these. Direct source-relative imports (e.g. `../../agent/assistant/src/graphstore.ts`) work in tests but fight with alias-based imports in routers.
  Evidence: Attempts to import `linkRagProvenanceToReasoning` directly into `graph.integration.test.ts` triggered module resolution errors until tests were aligned around mocks and the existing alias usage.

- Observation: Mindscape’s use of React Flow and React Three Fiber requires additional DOM shims (for `HTMLCanvasElement.getContext`, `ResizeObserver`, `screen`) to run in Bun/JSDOM. Adding provenance edge styling on top of this is safe but must not introduce new hooks that trigger infinite render loops.
  Evidence: Adjustments to `apps/web/src/test/dom.ts` and refactoring `KnowledgeNode` to use `useMindscapeStore.getState()` inside click handlers rather than as a subscribed hook avoided `Maximum update depth exceeded` errors.

## Decision Log

- Decision: Represent RAG provenance at the document level, not per-chunk, for the first iteration.
  Rationale: RAG chunks are already aggregated by document ID in retrieval, and document-level nodes keep the graph simpler while still answering “which documents were used.” Chunk-level linking can be added later if needed.
  Date/Author: 2025-11-21, Codex agent.

- Decision: Store provenance edges (`kind="explains"`) under the `user` resource rather than under per-run `runtime:<runId>` resources.
  Rationale: Mindscape and graph APIs already default to `resource="user"` for many queries. Keeping provenance edges in `user` scope ensures they are visible to existing queries and avoids scattering provenance across multiple resources.
  Date/Author: 2025-11-21, Codex agent.

- Decision: Use a dedicated helper (`linkRagProvenanceToReasoning`) in `graphstore` rather than merging provenance logic into `persistReasoning` itself.
  Rationale: Provenance edge creation is a separate concern from reasoning node creation, and having it as an explicit helper allows orchestration code to choose when to invoke it (immediately, deferred, or as a background job) without complicating the core persistence path.
  Date/Author: 2025-11-21, Codex agent.

## Outcomes & Retrospective

This section will be filled in once runtime workflows are actually wired to persist provenance and an end-to-end test demonstrates RAG → reasoning links in production code paths. At that point, we will compare:

- The intended behavior (“workflows clearly show which documents informed each reasoning step”) versus
- The implemented behavior under sqlite and Postgres, including Mindscape interactions and graph queries.

We will also document any issues with path aliases, metrics, or test environment constraints that affected implementation.

## Context and Orientation

The runtime provenance feature sits at the intersection of four major areas of this repository:

1. **Runtime context builder (`packages/runtime/src/context.ts`)**  
   The `ContextBuilder` class builds an `ExecutionContext` for a workflow run by gathering code context, web context, and RAG context. It already tracks `ragChunks` and now also tracks `ragDocumentIds`, which are the unique IDs of RAG documents used when constructing the context. This type does not know anything about the database directly; it is concerned with in-memory context for planning.

2. **RAG ingestion and enrichment (`packages/rag/` and `packages/db/src/repo/rag.ts`)**  
   `@alfred/rag.ingest(source, content)` creates `rag_documents` and `rag_chunks` rows in the DB. The RAG repo (`packages/db/src/repo/rag.ts`) handles semantic and hybrid search, returning `Chunk` results that include `documentId` in their metadata. When `RAG_ENRICH_GRAPH=1`, `packages/rag/src/doc.ts` calls `enrichGraphFromChunks`, which now also creates a `rag_document` node in `memory_nodes` under `resource="user"` with `properties.documentId` and `properties.ragResource`.

3. **Graph persistence and reasoning (`packages/agent/assistant/src/graphstore.ts` and `packages/db/src/repo/graph.ts`)**  
   The `graphstore` module provides `persistKnowledge`, `persistReasoning`, and `persistCodexExecution` to write hypergraph entries and reasoning traces into `memory_nodes` and `memory_edges`. Reasoning nodes live under a resource (e.g. `runtime:<runId>` or a workspace resource) and now include `ragDocumentIds` in their `properties`. The graph repo (`packages/db/src/repo/graph.ts`) has helpers like `getReasoningChain` and, after our changes, `findRagDocumentNode(documentId)` that look up RAG document nodes in the graph.

4. **Graph API and Mindscape UI (`packages/api/src/routers/graph.ts` and `apps/web/src/components/mindscape/`)**  
   The `graphRouter` exposes tRPC procedures `getEdges`, `connect`, `watchEdges`, and `runQuery` that operate on the graph. Mindscape’s initializer (`apps/web/src/components/mindscape/initializer.tsx`) uses `graph.getEdges`, `graph.watchEdges`, and `graph.runQuery` to hydrate React Flow nodes and edges. It already distinguishes RAG-backed `knowledge` nodes (`source="rag"`) from runtime nodes (`source="runtime"`) and now styles `explains` edges distinctly.

The missing piece is **orchestration**: wiring the runtime workflow path (which uses `ContextBuilder` and produces reasoning traces) to:

- Pass `ExecutionContext.ragDocumentIds` into `persistReasoning`, and
- Call `linkRagProvenanceToReasoning` after reasoning has been persisted.

Once this is done, the system will produce provenance edges automatically for every workflow run that uses RAG context.

## Plan of Work

The plan is divided into three phases, each of which builds on the previous ones. A novice should follow the phases in order and keep this document updated as they go.

### Phase 1: Confirm and document existing provenance foundations

Start by verifying and documenting the pieces we already have:

1. Open `packages/runtime/src/context.ts` and confirm that:
   - `ExecutionContext` includes `ragChunks?: Chunk[]` and `ragDocumentIds?: string[]`.
   - `ContextBuilder.build` populates `ragDocumentIds` based on `ragChunks[*].metadata.documentId`.
2. Open `packages/rag/src/doc.ts` and confirm that:
   - `enrichGraphFromChunks` calls `upsertNodes` with a `rag_document` node under `resource="user"`.
   - The `properties` for that node include `documentId` and `ragResource`.
3. Open `packages/agent/assistant/src/graphstore.ts` and confirm that:
   - `persistReasoning` accepts `ragDocumentIds` in the `context` parameter and writes it into reasoning node `properties`.
   - `linkRagProvenanceToReasoning` exists and creates `explains` edges between RAG document nodes and reasoning nodes.
4. Run the dedicated unit test `packages/agent/assistant/test/graphstore-rag-provenance.test.ts` to verify that the helper behaves as expected in isolation.

This phase ensures that the reader understands the current state and has confidence in the primitives before touching orchestrator code.

### Phase 2: Design and implement orchestration hooks in the runtime workflow path

In this phase, we will connect the runtime workflow execution to the provenance hooks without changing the core runtime semantics.

1. Identify how `createRuntime` is used by the API workflow router:
   - Open `packages/api/src/routers/workflow.ts` and locate the `createWorkflowExecutor` function, which chooses between `createRuntime` and `runPlanV6` based on the `USE_WORKFLOW_RUNTIME` environment flag.
   - Note that when `USE_WORKFLOW_RUNTIME === "true"`, the router constructs a runtime via `createRuntime({ input, model, signal })` and then uses its `stream` and `resume` APIs to drive workflow events.
2. Inspect the runtime implementation:
   - Open `packages/runtime/src/core.ts` and read the `WorkflowRuntime` class and the `createRuntime` factory.
   - Identify the phase where `ContextBuilder` is used (currently in the `executePlanPhase` generator) and how events are streamed (`AsyncGenerator<WorkflowEvent>`).
   - Confirm that `ContextBuilder.build` is called once per run, yielding an `ExecutionContext` object with `ragDocumentIds` available.
3. Decide where to call `persistReasoning` and `linkRagProvenanceToReasoning` for runtime workflows:
   - For this phase, prefer an adapter in the API layer rather than modifying `WorkflowRuntime` directly.
   - Introduce a small helper in `packages/api/src/workflow/runner.ts` or a new module under `packages/api/src/workflow/` that:
     - Accepts `{ resource, executionId, traces, context }`, where `context` is an `ExecutionContext` instance (or equivalent).
     - Calls `persistReasoning(resource, traces, { threadId, executionId, auto, ragDocumentIds: context.ragDocumentIds })`.
     - Calls `linkRagProvenanceToReasoning({ runtimeResource: resource, executionId })` once persistence completes.
   - Use dynamic imports (`await import("../../agent/assistant/src/graphstore.ts")`) in the API layer to avoid pulling assistant/hypergraph code into the client bundle.
4. Plumb `ExecutionContext` and traces into this helper:
   - Locate where the API `workflow` router or its associated helpers consume the runtime’s `stream` of `WorkflowEvent` objects.
   - Determine how reasoning traces are represented in the runtime events (e.g., specific `WorkflowEvent` types or accumulated logs).
   - Introduce a small accumulator in the API layer that:
     - Captures reasoning-like events (textual explanations or plan descriptions).
     - Records `{ text, timestamp }` per reasoning step in an array.
   - Once the workflow completes (or reaches a terminal “plan/reflect” phase), call the helper from step 3 with:
     - `resource` set to the workspace or `runtime:<runId>` resource used in the rest of the graph integration.
     - `executionId` set to the workflow run ID.
     - `traces` set to the accumulated reasoning steps.
     - `context` set to the `ExecutionContext` returned by `ContextBuilder.build`, so `ragDocumentIds` are available.

Phase 2’s goal is a clear, centralized place in the API layer where reasoning persistence and provenance linking happen for runtime workflows, separate from the codex tool.

### Phase 3: End-to-end provenance smoke tests

With the orchestrator hooked up, we need tests that demonstrate behavior in a realistic environment without depending on Postgres.

1. Add a sqlite-backed provenance integration test:
   - Create a new test file under `packages/api/test/workflow.runtime-provenance.integration.test.ts`.
   - Use the same sqlite setup pattern as `graph.integration.test.ts` and `workflow.reasoning.integration.test.ts`: set `DATABASE_URL = "sqlite::memory:"`, disable heavy metrics, and ensure migrations are implicitly applied via the sqlite schema helper.
   - In the test:
     - Ingest a small RAG document via `@alfred/rag.ingest(source, content)` with `RAG_ENRICH_GRAPH=1`.
     - Use a simplified or mocked runtime execution that:
       - Calls `ContextBuilder.build` for a requirement that triggers RAG retrieval.
       - Produces a small set of reasoning traces for the same run ID.
       - Invokes the orchestration helper from Phase 2 to call `persistReasoning` and `linkRagProvenanceToReasoning`.
     - Query the DB via `@alfred/db/schema/graph` and `@alfred/db/repo/graph` to assert:
       - At least one `rag_document` node exists under `resource="user"` with a matching `documentId`.
       - At least one `reasoning` node exists under the runtime resource with `properties.ragDocumentIds` including that documentId.
       - At least one `explains` edge exists with `fromId = rag_document.id`, `toId = reasoning.id`, `resource="user"`, and `metadata.documentId` set.
2. Add a graph API-level check (optional but recommended):
   - Within the same test (or a sibling test), use a tRPC test caller for the graph router (patterned after `graph.integration.test.ts`) to call:
     - `graph.runQuery` with `kind: "traverse"`, `nodeId = reasoningNodeId`, `resource = "user"`, and `direction = "in"`.
   - Assert that:
     - Returned nodes include both the RAG document label and the reasoning label (or at least their IDs).
     - Returned edges include a `kind: "explains"` edge connecting the two.

This phase proves that provenance is not only persisted but also discoverable via the same graph APIs that Mindscape uses.

### Phase 4: Mindscape provenance affordances (verification and polish)

Most of the UI groundwork is already done, but this phase ensures it is correctly exercised and documented.

1. Verify RAG vs runtime node styling and filters:
   - Open `apps/web/src/store/mindscape.schemas.ts` and confirm that `knowledgeNodeDataSchema` includes `source: "user" | "runtime" | "rag"`.
   - Open `apps/web/src/components/mindscape/initializer.tsx` and confirm that:
     - Knowledge nodes created from `graph.runQuery(kind: "traverse")` are tagged with `source: "runtime"`.
     - Knowledge nodes created from `graph.runQuery(kind: "semantic", preferRag: true)` are tagged with `source: "rag"`.
   - Open `apps/web/src/components/mindscape/canvas.tsx` and confirm that the legend panel exposes checkboxes to show/hide runtime and RAG knowledge, and that filtered nodes/edges are computed via `visibleNodes` and `visibleEdges`.
2. Verify explains-edge styling:
   - In `initializer.tsx`, confirm that `mapEdgeToFlow` detects `edge.kind === "explains"` and assigns the green, dashed style.
   - Optionally, extend Mindscape tests:
     - Update `apps/web/src/components/__tests__/mindscape.graph.test.tsx` so that mocked `graph.getEdges` or `graph.runQuery` responses include an `explains` edge between a runtime node and a RAG node, and assert that React Flow renders such an edge (e.g., by querying for an element with a known `id`).
3. Document Mindscape provenance behavior:
   - Update `docs/architecture/hypergraph.md` (where Mindscape integration is already described) to:
     - Note that RAG document nodes (`kind="rag_document"`, resource `"user"`) are now created during RAG enrichment.
     - Clarify that `explains` edges connect these RAG document nodes to reasoning nodes when runtime workflows use RAG context, and that Mindscape renders them as green, dashed edges.

This phase makes it easy for contributors to understand how provenance appears in the UI and tests.

## Concrete Steps

The following commands assume the repository root as the working directory.

1. Validate existing provenance primitives and tests:

    - Run the agent graphstore tests (sqlite and unit):

          bun test packages/agent/assistant/test/graphstore.integration.test.ts
          bun test packages/agent/assistant/test/graphstore-rag-provenance.test.ts

      Expected: both tests pass. The integration test verifies basic graphstore behavior against sqlite; the provenance test verifies that `linkRagProvenanceToReasoning` produces correct `explains` edges given mocked DB helpers.

    - Run the graph router integration tests under sqlite:

          bun test packages/api/test/graph.integration.test.ts

      Expected: all three tests pass, confirming that `graph.getEdges` and `graph.connect` work correctly against the sqlite fallback and that mocks around the assistant hypergraph bridge do not interfere.

    - Run the Mindscape graph test (with DOM shims):

          bun test apps/web/src/components/__tests__/mindscape.graph.test.tsx

      Expected: the test passes, and the console output may include jsdom warnings and mocked tRPC logs, but no assertion failures.

2. After wiring runtime → `persistReasoning` → `linkRagProvenanceToReasoning`:

    - Run the new workflow runtime provenance integration test (to be added under `packages/api/test/workflow.runtime-provenance.integration.test.ts`):

          bun test packages/api/test/workflow.runtime-provenance.integration.test.ts

      Expected: the test passes and logs show a small number of `memory_nodes` and `memory_edges` rows created under sqlite, including at least one `rag_document` node and at least one `explains` edge connecting it to a reasoning node.

3. Full integration sweep (optional but recommended before merging):

    - Run the existing integration suite:

          bun run test:integration

      Expected: hypergraph, graphstore, graph router, workflow reasoning, and workflow capture integration tests remain green, and any new provenance tests are included in the integration pipeline if appropriate.

## Validation and Acceptance

This ExecPlan is complete and acceptable when all of the following are true:

1. **Runtime provenance capture:**
   - When a workflow is executed through the runtime path (with `USE_WORKFLOW_RUNTIME=true` and RAG enabled), the `ExecutionContext` used for that run includes a non-empty `ragDocumentIds` array.
   - After the run completes, reasoning nodes persisted via `persistReasoning` for that run include `ragDocumentIds` in their `properties`, and a subsequent call to `linkRagProvenanceToReasoning` creates `explains` edges between the corresponding RAG document nodes (`kind="rag_document"`, resource `"user"`) and those reasoning nodes.

2. **Graph/API integration:**
   - A sqlite-backed test (under `packages/api/test`) confirms that:
     - `rag_document` nodes are present in `memory_nodes` with correct `documentId` properties.
     - Reasoning nodes for a given run carry `ragDocumentIds`.
     - `linkRagProvenanceToReasoning` produces `explains` edges that can be observed via `@alfred/db/repo/graph` or via `graph.runQuery` (`kind: "traverse"`, `direction: "in"`, `resource: "user"`).

3. **Mindscape visualization:**
   - Mindscape renders:
     - RAG-backed `knowledge` nodes with a distinct visual style (emerald border, sparkles icon, “RAG Context” label).
     - Runtime `knowledge` nodes with the existing biolum theme.
     - Explains edges (`kind="explains"`) as green, dashed lines between RAG document nodes and reasoning nodes when such edges exist in the graph.
   - The legend’s Runtime and RAG toggles hide/show the corresponding `knowledge` nodes and their edges without breaking layout or causing render loops.

4. **Documentation:**
   - `docs/architecture/hypergraph.md` and relevant workflow/runtime docs explain:
     - How RAG documents are ingested and enriched into the graph.
     - How runtime context builder tracks `ragDocumentIds`.
     - How reasoning persistence and `linkRagProvenanceToReasoning` create `explains` edges.
     - How Mindscape consumes and visualizes these connections.

## Idempotence and Recovery

Most steps in this plan are idempotent and safe to repeat:

- Updating `ExecutionContext` and the RAG enrichment path is idempotent at the code level; re-running tests simply reuses the in-memory sqlite DBs defined in the test harness.
- `persistReasoning` and `linkRagProvenanceToReasoning` are designed to be safe to call multiple times for the same `(resource, executionId)` pair:
  - Reasoning nodes are keyed by content and execution metadata; duplicate calls should re-upsert the same nodes without creating duplicates.
  - `linkRagProvenanceToReasoning` uses deterministic hashes for edge IDs, so `upsertEdges` with conflict handling can be extended to avoid duplicate edges if needed.

For recovery:

- If adding provenance hooks to the runtime workflow path causes failures, the simplest rollback is to:
  - Temporarily disable calls to `persistReasoning` and `linkRagProvenanceToReasoning` in the runtime orchestrator, restoring the previous behavior.
  - Keep the lower-level provenance primitives (ExecutionContext, RAG doc nodes, graphstore helpers) in place, as they are isolated and covered by unit/integration tests.

## Artifacts and Notes

- Example: After wiring everything and running a RAG-backed workflow, a DB snapshot (via `psql` or Drizzle) for `memory_nodes` might show:

    - A row with `kind="rag_document"`, `resource="user"`, `label="test:note:123"`, and `properties.documentId = "rag-doc-uuid"`.
    - One or more rows with `kind="reasoning"`, `resource="runtime:<runId>"`, `properties.executionId = "<runId>"`, and `properties.ragDocumentIds = ["rag-doc-uuid"]`.

  And `memory_edges` might show:

    - A row with `kind="explains"`, `resource="user"`, `from_id = <rag_document.id>`, `to_id = <reasoning.id>`, and `metadata.documentId = "rag-doc-uuid"`.

- Example: A Mindscape session where:

    - A note and a workflow node are present.
    - A RAG-backed `knowledge` node appears with label “RAG Context Node” and green styling.
    - A dashed green edge connects that RAG node to a runtime `knowledge` node representing a reasoning step.

## Interfaces and Dependencies

At the end of this ExecPlan, the following interfaces and contracts must hold:

- `packages/runtime/src/context.ts`:

    - `ExecutionContext` includes `ragDocumentIds?: string[]` and is populated by `ContextBuilder.build` based on RAG chunk metadata.

- `packages/rag/src/doc.ts`:

    - `enrichGraphFromChunks` upserts a `rag_document` graph node under `resource="user"` with `properties.documentId` and `properties.ragResource`.

- `packages/agent/assistant/src/graphstore.ts`:

    - `persistReasoning(resource, traces, context)` accepts `context.ragDocumentIds` and writes it into reasoning node `properties`.
    - `linkRagProvenanceToReasoning({ runtimeResource, executionId })`:
      - Calls `getReasoningChain` and `findRagDocumentNode`.
      - Creates `explains` edges under `resource="user"` from RAG document nodes to reasoning nodes.

- `packages/db/src/repo/graph.ts`:

    - `findRagDocumentNode(documentId: string): Promise<NodeRow | null>` returns the user-scoped RAG document node or `null`.

- `packages/api/src/routers/graph.ts`:

    - `graphRouter.runQuery` continues to support `TraverseQuery`, `PathQuery`, `DatalogQuery`, and `SemanticQuery`, and returns `UnifiedNode[]` / `UnifiedEdge[]` that include `explains` edges when present.

- `apps/web/src/components/mindscape/initializer.tsx` and `nodes/knowledge-node.tsx`:

    - Knowledge nodes created from `graph.runQuery(kind: "traverse")` are tagged `source="runtime"`.
    - Knowledge nodes created from `graph.runQuery(kind: "semantic", preferRag: true)` are tagged `source="rag"`.
    - RAG nodes have a green, sparkly appearance and a “Use in Workflow” affordance.
    - `explains` edges are rendered as dashed green connections between RAG and reasoning nodes.

Once these interfaces are stable and the validation criteria pass, runtime workflows will have fully integrated, queryable, and visually meaningful provenance for their use of RAG documents.

