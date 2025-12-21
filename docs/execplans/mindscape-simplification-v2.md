# Mindscape Simplification: Standardized Nodes, WebGPU Feature Flag, and Workflow Execution

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

The current Mindscape implementation has grown organically with 20+ node types, a half-integrated WebGPU renderer, no real data flow between nodes, and inconsistent patterns across components. This refactor transforms Mindscape from a visual-only canvas into a functional workflow execution system similar to n8n, where nodes have typed inputs/outputs and data flows through edges.

After this change, users gain:

1. **Executable workflows**: Connect nodes with typed edges; data flows from output ports to input ports; workflows execute in topological order
2. **Consistent node UX**: All nodes share the same shell (handles, LOD, focus states) with domain-specific content
3. **Optional WebGPU visuals**: Compile-time flag enables/disables the ASCII interference background without affecting core functionality
4. **Testable architecture**: Each node is a pure function mapping inputs to outputs; stores are separated by concern

Success is demonstrated by:

- Creating a simple workflow (e.g., Chat → Extract Text → Create Note) and executing it end-to-end
- Running `bun test` with >80% coverage on node definitions and execution engine
- Building with `ENABLE_WEBGPU=false` produces a bundle without any WebGPU/shader code

## Progress

- [ ] Phase 0: Audit and cleanup (delete broken nodes, catalog what remains)
- [ ] Phase 1: WebGPU feature flag (move to @alfred/cortex, compile-time exclusion)
- [ ] Phase 2: Node standardization (NodeShell wrapper, unified LOD, port system)
- [ ] Phase 3: Store separation (canvas state vs execution state vs persistence)
- [ ] Phase 4: Execution engine (DAG runner, typed connections, data flow)
- [ ] Phase 5: Migration of existing nodes to new architecture
- [ ] Phase 6: Workflow builder UI (connection validation, execution controls)

## Surprises & Discoveries

(To be filled as work proceeds)

## Decision Log

(To be filled as decisions are made)

## Outcomes & Retrospective

(To be filled at milestones)

## Context and Orientation

### Current State Problems

The Mindscape system lives in `apps/web/src/components/mindscape/` with these issues:

**Problem 1: WebGPU is disconnected**
- `apps/web/src/lib/mindscape/engine.ts` - MindscapeEngine class with WebGPU init
- `apps/web/src/lib/mindscape/renderer.ts` - MindscapeRenderer with compute/fragment shaders
- `apps/web/src/lib/mindscape/fragment.wgsl` and `compute.wgsl` - WGSL shaders
- These files exist but are NOT used in the actual Mindscape canvas
- The canvas uses ReactFlow exclusively; WebGPU was meant for background effects

**Problem 2: Node implementations are inconsistent**
- 20+ node types in `apps/web/src/components/mindscape/nodes/`
- Each implements its own LOD logic (duplicated switch statements)
- No shared base component; handle positions vary per node
- Some nodes are functional (chat, note), others are stubs (deployment, integrations)
- No concept of input/output ports for data flow

**Problem 3: Single bloated store**
- `apps/web/src/store/mindscape.ts` - 400+ lines handling:
  - Node/edge graph state (ReactFlow)
  - RAG document cache with TTL/eviction
  - Context cache for receipts
  - Feedback tracking
  - Persistence to localStorage
- No separation between runtime state and what should persist

**Problem 4: No execution model**
- Edges are purely visual decorations
- No typed ports (inputs/outputs)
- No data transformation through edges
- No workflow execution engine
- LivingEdge animates but carries no data

### Key Files to Modify

    apps/web/src/components/mindscape/
      canvas.tsx           # Main ReactFlow wrapper
      nodes/*.tsx          # Individual node implementations
      living-edge.tsx      # Edge component
      lod.ts               # LOD hook (to be centralized)
      spawn.ts             # Node creation helpers
      types.ts             # Type definitions

    apps/web/src/store/
      mindscape.ts         # Bloated store (to be split)
      mindscape.schemas.ts # Zod schemas for node data

    apps/web/src/lib/mindscape/
      engine.ts            # WebGPU engine (to move to @alfred/cortex)
      renderer.ts          # WebGPU renderer
      *.wgsl               # Shaders

    packages/cortex/       # Existing WebGPU package (target for consolidation)

### Terms Defined

- **Port**: A typed connection point on a node. Input ports receive data; output ports emit data.
- **Edge**: A connection between an output port and an input port. Carries typed data.
- **DAG**: Directed Acyclic Graph. Workflows must not have cycles to execute deterministically.
- **LOD (Level of Detail)**: Nodes render differently based on zoom level (tiny/small/medium/full).
- **NodeShell**: A wrapper component that provides consistent handles, LOD switching, and focus states for all node types.
- **Execution Context**: Runtime state during workflow execution (current node, accumulated data, abort signal).

## Plan of Work

### Phase 0: Audit and Cleanup

Goal: Identify what exists, delete broken/stub code, establish baseline.

Work:
1. Audit all 20+ node types; categorize as functional/stub/broken
2. Delete nodes that are pure stubs with no functionality
3. Document remaining nodes and their current capabilities
4. Run existing tests; establish baseline coverage

Result: A smaller, cleaner set of nodes to standardize.

### Phase 1: WebGPU Feature Flag

Goal: Move all WebGPU code to `@alfred/cortex` and gate with compile-time flag.

Work:
1. Move these files from `apps/web/src/lib/mindscape/` to `packages/cortex/src/`:
   - engine.ts → packages/cortex/src/mindscape/engine.ts
   - renderer.ts → packages/cortex/src/mindscape/renderer.ts
   - *.wgsl → packages/cortex/src/mindscape/shaders/
   - font-atlas.ts → packages/cortex/src/mindscape/font-atlas.ts
   - math.ts → packages/cortex/src/mindscape/math.ts

2. Create feature flag in build config:

    // vite.config.ts
    define: {
      'import.meta.env.ENABLE_WEBGPU': JSON.stringify(process.env.ENABLE_WEBGPU === 'true')
    }

3. Create lazy loader in web app:

    // apps/web/src/lib/mindscape/webgpu.ts
    export async function loadWebGPUEngine() {
      if (!import.meta.env.ENABLE_WEBGPU) {
        return null;
      }
      const { MindscapeEngine } = await import('@alfred/cortex/mindscape');
      return MindscapeEngine;
    }

4. Update Mindscape canvas to optionally render WebGPU background layer

Result: `ENABLE_WEBGPU=false bun run build` produces bundle without WebGPU code.

### Phase 2: Node Standardization

Goal: All nodes use a common shell with consistent handles, LOD, and port definitions.

Work:
1. Create NodeShell wrapper component:

    // apps/web/src/components/mindscape/node-shell.tsx
    interface NodeShellProps {
      id: string;
      type: string;
      inputs?: PortDefinition[];
      outputs?: PortDefinition[];
      children: (props: { lod: LODLevel }) => ReactNode;
    }

    export function NodeShell({ id, type, inputs, outputs, children }: NodeShellProps) {
      const lod = useLOD();
      const { isFocused, isDimmed } = useNodeFocus(id);
      
      return (
        <div className={cn('node-shell', { focused: isFocused, dimmed: isDimmed })}>
          {inputs?.map(port => <InputHandle key={port.name} port={port} />)}
          {children({ lod })}
          {outputs?.map(port => <OutputHandle key={port.name} port={port} />)}
        </div>
      );
    }

2. Define port type system:

    // apps/web/src/components/mindscape/ports.ts
    type PortType = 'text' | 'number' | 'boolean' | 'json' | 'file' | 'any';

    interface PortDefinition {
      name: string;
      type: PortType;
      required?: boolean;
      description?: string;
    }

3. Create node definition registry:

    // apps/web/src/components/mindscape/registry.ts
    interface NodeDefinition<TData> {
      type: string;
      schema: z.ZodSchema<TData>;
      inputs?: PortDefinition[];
      outputs?: PortDefinition[];
      render: React.FC<{ data: TData; lod: LODLevel }>;
      execute?: (inputs: Record<string, unknown>, data: TData) => Promise<Record<string, unknown>>;
    }

    const nodeRegistry = new Map<string, NodeDefinition<unknown>>();

    export function defineNode<TData>(def: NodeDefinition<TData>) {
      nodeRegistry.set(def.type, def as NodeDefinition<unknown>);
      return def;
    }

4. Migrate existing nodes to use NodeShell and registry pattern

Result: All nodes have consistent UI wrapper; ports are visible and typed.

### Phase 3: Store Separation

Goal: Split monolithic store into focused, testable slices.

Work:
1. Create three separate stores:

    // apps/web/src/store/mindscape/canvas.ts
    // Owns: nodes, edges, viewport, selection
    // Persists: node positions, edge connections

    // apps/web/src/store/mindscape/execution.ts  
    // Owns: running workflows, execution state, data flow
    // Does NOT persist (runtime only)

    // apps/web/src/store/mindscape/cache.ts
    // Owns: RAG doc cache, context receipts, feedback
    // Persists: cache entries with TTL

2. Create unified hook for components:

    // apps/web/src/store/mindscape/index.ts
    export function useMindscape() {
      const canvas = useCanvasStore();
      const execution = useExecutionStore();
      const cache = useCacheStore();
      return { canvas, execution, cache };
    }

3. Update all components to use new store structure

Result: Each store is <150 lines; easy to test in isolation.

### Phase 4: Execution Engine

Goal: Nodes can execute and pass data through edges.

Work:
1. Create execution engine:

    // packages/mindscape/src/execution/engine.ts
    interface ExecutionContext {
      workflowId: string;
      abortSignal: AbortSignal;
      onNodeStart: (nodeId: string) => void;
      onNodeComplete: (nodeId: string, outputs: Record<string, unknown>) => void;
      onNodeError: (nodeId: string, error: Error) => void;
    }

    export class WorkflowEngine {
      async execute(
        nodes: ExecutableNode[],
        edges: TypedEdge[],
        initialInputs: Record<string, unknown>,
        context: ExecutionContext
      ): AsyncGenerator<ExecutionEvent> {
        // 1. Validate DAG (no cycles)
        // 2. Topological sort
        // 3. Execute nodes in order
        // 4. Pass outputs to connected inputs via edges
        // 5. Yield events for UI updates
      }
    }

2. Create typed edge validation:

    // packages/mindscape/src/execution/validation.ts
    export function validateConnection(
      sourcePort: PortDefinition,
      targetPort: PortDefinition
    ): { valid: boolean; reason?: string } {
      // Check type compatibility
      // 'any' accepts all types
      // Exact type match required otherwise
    }

3. Integrate with canvas store:

    // When user draws edge, validate types
    // When user clicks "Run", execute workflow
    // Stream execution events to update node states

Result: Users can build and execute simple workflows.

### Phase 5: Node Migration

Goal: Convert all remaining nodes to new architecture.

Work:
1. Start with simple nodes (note, reminder, timer)
2. Add execute() functions where applicable
3. Define meaningful inputs/outputs:

    // Example: Note node
    defineNode({
      type: 'note',
      schema: noteNodeDataSchema,
      inputs: [
        { name: 'content', type: 'text', required: false }
      ],
      outputs: [
        { name: 'note', type: 'json' }
      ],
      execute: async (inputs, data) => {
        const content = inputs.content ?? data.content;
        const note = await trpc.note.create.mutate({ content });
        return { note };
      }
    });

4. Complex nodes (chat, workflow) may have multiple inputs/outputs

Result: All nodes are executable and can participate in workflows.

### Phase 6: Workflow Builder UI

Goal: Intuitive UI for building and running workflows.

Work:
1. Connection validation feedback (red/green while dragging)
2. Execution controls (Run, Stop, Step)
3. Data flow visualization (highlight active edges, show values)
4. Workflow save/load (persist to server)
5. Template workflows (common patterns pre-built)

Result: Full n8n-like experience within Mindscape.

## Concrete Steps

### Phase 0 Commands

    # Audit node types
    ls apps/web/src/components/mindscape/nodes/

    # Run existing tests
    bun test apps/web/src/components/__tests__/mindscape*

    # Check bundle size baseline
    ENABLE_WEBGPU=true bun --filter @alfred/web build
    du -sh apps/web/dist/

### Phase 1 Commands

    # Create cortex mindscape directory
    mkdir -p packages/cortex/src/mindscape/shaders

    # Move files
    mv apps/web/src/lib/mindscape/engine.ts packages/cortex/src/mindscape/
    mv apps/web/src/lib/mindscape/renderer.ts packages/cortex/src/mindscape/
    mv apps/web/src/lib/mindscape/*.wgsl packages/cortex/src/mindscape/shaders/
    mv apps/web/src/lib/mindscape/font-atlas.ts packages/cortex/src/mindscape/
    mv apps/web/src/lib/mindscape/math.ts packages/cortex/src/mindscape/

    # Update imports in cortex
    # Add export from packages/cortex/src/index.ts

    # Build without WebGPU
    ENABLE_WEBGPU=false bun --filter @alfred/web build

    # Verify no WebGPU in bundle
    grep -r "webgpu\|GPUDevice" apps/web/dist/ || echo "No WebGPU found - success!"

### Phase 2 Commands

    # Create new files
    touch apps/web/src/components/mindscape/node-shell.tsx
    touch apps/web/src/components/mindscape/ports.tsx
    touch apps/web/src/components/mindscape/registry.ts

    # Run type check after migration
    bun --filter @alfred/web typecheck

### Phase 3 Commands

    # Create store directory structure
    mkdir -p apps/web/src/store/mindscape

    # Split store files
    touch apps/web/src/store/mindscape/canvas.ts
    touch apps/web/src/store/mindscape/execution.ts
    touch apps/web/src/store/mindscape/cache.ts
    touch apps/web/src/store/mindscape/index.ts

    # Run tests after migration
    bun test apps/web/src/store/

### Phase 4 Commands

    # Create execution package (or add to existing mindscape location)
    mkdir -p apps/web/src/lib/mindscape/execution

    touch apps/web/src/lib/mindscape/execution/engine.ts
    touch apps/web/src/lib/mindscape/execution/validation.ts
    touch apps/web/src/lib/mindscape/execution/types.ts

    # Add tests
    touch apps/web/src/lib/mindscape/execution/__tests__/engine.test.ts

    # Run execution tests
    bun test apps/web/src/lib/mindscape/execution/

## Validation and Acceptance

### Phase 0 Acceptance
- List of nodes categorized (functional/stub/deleted)
- Test baseline established with coverage %

### Phase 1 Acceptance
- Build with `ENABLE_WEBGPU=false` succeeds
- Bundle does not contain WebGPU strings
- Build with `ENABLE_WEBGPU=true` renders ASCII background (if wired up)

### Phase 2 Acceptance
- All nodes render using NodeShell
- Ports are visible at LOD medium and above
- Handles align consistently across all node types

### Phase 3 Acceptance
- Each store file is <150 lines
- Stores can be tested in isolation (mock-free unit tests)
- Persistence only saves necessary state

### Phase 4 Acceptance
- Simple workflow executes: ChatNode → NoteNode (chat output becomes note content)
- Execution events stream to UI (node states update)
- Invalid connections are rejected with feedback

### Phase 5 Acceptance
- All remaining nodes have execute() functions
- >80% test coverage on node definitions

### Phase 6 Acceptance
- User can build workflow by dragging connections
- Run button executes workflow
- Data values shown on edges during execution

## Idempotence and Recovery

- All migrations are additive (new files) then subtractive (delete old)
- Feature flag allows gradual rollout of WebGPU
- Store split maintains backward compatibility via unified hook
- If execution engine fails, canvas still functions (visual-only mode)

## Artifacts and Notes

### Node Audit Template

    | Node Type | Status | Has CRUD | Has Execute | Inputs | Outputs | Notes |
    |-----------|--------|----------|-------------|--------|---------|-------|
    | chat      | ✓      | ✓        | ✓           | prompt | response| Main AI node |
    | note      | ✓      | ✓        | Partial     | content| note    | Needs execute |
    | orb       | ✓      | ✗        | ✗           | -      | -       | Visual only |
    | deployment| Stub   | ✗        | ✗           | -      | -       | Delete? |

### Port Type Compatibility Matrix

    | Source → Target | text | number | boolean | json | file | any |
    |-----------------|------|--------|---------|------|------|-----|
    | text            | ✓    | ✗      | ✗       | ✗    | ✗    | ✓   |
    | number          | ✓*   | ✓      | ✗       | ✗    | ✗    | ✓   |
    | boolean         | ✓*   | ✗      | ✓       | ✗    | ✗    | ✓   |
    | json            | ✓*   | ✗      | ✗       | ✓    | ✗    | ✓   |
    | file            | ✗    | ✗      | ✗       | ✗    | ✓    | ✓   |
    | any             | ✓    | ✓      | ✓       | ✓    | ✓    | ✓   |

    * = with automatic coercion (toString)

## Interfaces and Dependencies

### New Package Structure

    packages/
      cortex/                    # WebGPU rendering (feature-flagged)
        src/
          mindscape/
            engine.ts            # MindscapeEngine class
            renderer.ts          # WebGPU pipeline
            font-atlas.ts        # Glyph texture generation
            math.ts              # Interference calculations
            shaders/
              compute.wgsl
              fragment.wgsl

    apps/web/src/
      components/mindscape/
        canvas.tsx               # ReactFlow + optional WebGPU layer
        node-shell.tsx           # Unified node wrapper (NEW)
        ports.tsx                # Port components (NEW)
        registry.ts              # Node definition registry (NEW)
        living-edge.tsx          # Edge with data flow visualization
        nodes/
          *.tsx                  # Migrated to use NodeShell

      store/mindscape/
        canvas.ts                # Graph state (NEW)
        execution.ts             # Runtime state (NEW)
        cache.ts                 # Cache state (NEW)
        index.ts                 # Unified exports (NEW)

      lib/mindscape/
        execution/
          engine.ts              # Workflow executor (NEW)
          validation.ts          # Connection validator (NEW)
          types.ts               # Execution types (NEW)

### Key Interfaces

    // Port Definition
    interface PortDefinition {
      name: string;
      type: 'text' | 'number' | 'boolean' | 'json' | 'file' | 'any';
      required?: boolean;
      description?: string;
    }

    // Node Definition
    interface NodeDefinition<TData> {
      type: string;
      label: string;
      schema: z.ZodSchema<TData>;
      inputs?: PortDefinition[];
      outputs?: PortDefinition[];
      render: React.FC<{ data: TData; lod: LODLevel }>;
      execute?: (
        inputs: Record<string, unknown>,
        data: TData,
        context: ExecutionContext
      ) => Promise<Record<string, unknown>>;
    }

    // Typed Edge
    interface TypedEdge {
      id: string;
      source: string;
      sourcePort: string;
      target: string;
      targetPort: string;
    }

    // Execution Event
    type ExecutionEvent =
      | { type: 'node_start'; nodeId: string }
      | { type: 'node_complete'; nodeId: string; outputs: Record<string, unknown> }
      | { type: 'node_error'; nodeId: string; error: string }
      | { type: 'edge_data'; edgeId: string; data: unknown }
      | { type: 'workflow_complete'; result: Record<string, unknown> }
      | { type: 'workflow_error'; error: string };

### Dependencies

    @xyflow/react          # Canvas and node rendering
    zustand                # State management (split stores)
    zod                    # Schema validation for node data and ports
    @alfred/cortex         # WebGPU rendering (optional)

## Revision Notes

- 2025-12-21: Initial plan created covering WebGPU feature flag, node standardization, store separation, and execution engine architecture.
