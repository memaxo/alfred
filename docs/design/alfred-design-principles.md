# ALFRED Design Principles: Comprehensive Guide

**Last Updated**: 2025-01-27

This document explains ALFRED's design principles in extreme detail, referencing existing design rules and explaining the node-based UI architecture built on xyflow (React Flow).

---

## Table of Contents

1. [Core Design Philosophy](#core-design-philosophy)
2. [Component Development Principles](#component-development-principles)
3. [Purity and Performance](#purity-and-performance)
4. [Node-Based UI Architecture](#node-based-ui-architecture)
5. [State Management Patterns](#state-management-patterns)
6. [Visual Design Language](#visual-design-language)
7. [Accessibility Standards](#accessibility-standards)
8. [Performance Optimization](#performance-optimization)

---

## Core Design Philosophy

### 1. Computational Austerity

**Principle**: Every element serves the domain directly. No ceremony, no indirection.

**Reference**: `.ruler/01-naming-conventions.md` - "Austerity. Every name directly serves the domain."

**Implementation**:
- **Single-word naming**: Files, directories, and exports use single lowercase words (`chat.tsx`, `note`, `remind`)
- **Domain-driven organization**: Code organized by domain nouns (`note`, `remind`, `timer`, `book`)
- **No abstraction layers**: Direct implementations over factories, managers, or registries
- **Cognitive domain alignment**: Code structure mirrors cognitive states (`idle`, `thinking`, `deciding`, `acting`, `learning`)

**Example**:
```typescript
// ✅ Correct: Direct, domain-aligned
export function note({ content }: { content: string }) {
  return { type: "note", content };
}

// ❌ Wrong: Abstracted, indirection
export class NoteManager {
  createNote(content: string) { ... }
}
```

### 2. Performance-First Design

**Principle**: Performance emerges from simplicity, not complexity.

**Reference**: `.ruler/09-purity-and-performance.md` - "Performance emerges from simplicity, not complexity."

**Implementation**:
- **Hot path identification**: Files ending in `.hot.ts` contain performance-critical code
- **Budget enforcement**: Functions declare and meet performance budgets:
  - `<100 µs`: State transitions, normalizations
  - `<1 ms`: Graph lookups, validation
  - `<10 ms`: Fact extraction, context building
  - `<100 ms`: Plan generation
  - `<16 ms`: UI render cycles (60fps)
- **Zero allocations in hot loops**: Reuse buffers, avoid spreading arrays
- **Measurement before optimization**: Instrument with `@alfred/metrics/performance` before optimizing

**Example**:
```typescript
// ✅ Correct: Pure function, meets budget
export function normalizeMessage(event: StreamEvent): UIMessage {
  // <100 µs budget
  return { ...event, normalized: true };
}

// ❌ Wrong: Side effects, allocations
export function normalizeMessage(event: StreamEvent): UIMessage {
  metrics.increment('normalizations'); // Side effect
  return [...event.parts].map(...); // Allocation
}
```

### 3. Purity by Default

**Principle**: Pure functions eliminate side effects, enable optimization, and reduce cognitive load.

**Reference**: `.ruler/09-purity-and-performance.md` - "Pure by default."

**Layer Map**:
- **Pure**: `packages/cognitive/`, `packages/knowledge/src/graph/`, flow functions, state transitions
- **Boundary**: `packages/api/src/routers/`, `packages/db/src/repos/`, schedulers
- **Never mix**: A single function must not both transform data AND perform I/O

**Example**:
```typescript
// ✅ Correct: Pure transformation
export function transition(state: CognitiveState, event: Event): CognitiveState {
  return { ...state, current: event.target };
}

// ❌ Wrong: Side effect in core logic
export function transition(state: CognitiveState, event: Event): CognitiveState {
  await db.save(state); // Side effect
  return { ...state, current: event.target };
}
```

---

## Component Development Principles

### 1. Composition Over Inheritance

**Principle**: Assemble small, single-purpose components into larger flows.

**Reference**: `.ruler/12-component-development.md` - "Composition. Assemble small, single-purpose components."

**Implementation**:
- **Single-purpose components**: Each component does one thing well
- **Composition pattern**: `ChatContainer = Chat + Actions + Controls + Connect`
- **Pure render logic**: No side effects, logging, or object creation inside JSX
- **Stable references**: Wrap components in `React.memo`, stabilize callbacks with `useCallback`

**Example**:
```typescript
// ✅ Correct: Composed from pure components
export function ChatContainer() {
  return (
    <div>
      <Header />
      <Chat messages={messages} onSend={handleSend} />
      <Actions actions={actions} />
    </div>
  );
}

// ❌ Wrong: Monolithic component
export function ChatContainer() {
  // Everything in one component
  return <div>{/* 500 lines of JSX */}</div>;
}
```

### 2. Reality-Driven UI

**Principle**: Visualizations derive directly from real system state or events.

**Reference**: `.ruler/12-component-development.md` - "Reality-driven UI. Visualizations must derive directly from real system state or events."

**Implementation**:
- **No simulation modes**: Never implement fake data generators or mock actions in production
- **State-driven rendering**: Components render based on actual data from tRPC queries
- **Event-driven updates**: UI updates respond to real workflow events, not timers or intervals
- **Activation fidelity**: Mindscape activations use distinct event types (`context-cache`, `workflow-step`, `tool-action`)

**Example**:
```typescript
// ✅ Correct: Real state from query
const { data: workflows } = trpc.workflow.list.useQuery();
return <WorkflowList workflows={workflows} />;

// ❌ Wrong: Mock data
const mockWorkflows = [{ id: "1", name: "Test" }];
return <WorkflowList workflows={mockWorkflows} />;
```

### 3. Performance Budgets

**Principle**: Every component must meet its performance budget.

**Reference**: `.ruler/12-component-development.md` - "Performance budgets. Target `<1 ms` message renders, `<5 ms` virtualised list mount, `<10 ms` form submissions, `<16 ms` animation frames."

**Implementation**:
- **Message renders**: `<1 ms` per message
- **Virtualized lists**: `<5 ms` mount time
- **Form submissions**: `<10 ms` processing
- **Animation frames**: `<16 ms` (60fps)
- **Profiling**: Profile hot components before optimizing

**Example**:
```typescript
// ✅ Correct: Virtualized for performance
import { Virtuoso } from "react-virtuoso";

<Chat
  ListComponent={Virtuoso}
  messages={messages}
  virtualized
/>

// ❌ Wrong: All messages rendered at once
{messages.map(msg => <Message key={msg.id} message={msg} />)}
```

---

## Purity and Performance

### 1. Pure Function Boundaries

**Principle**: Strict separation between pure functions and side effects.

**Reference**: `.ruler/09-purity-and-performance.md`

**Rules**:
1. **Pure by default**: Functions that transform data must be pure
2. **Side effects at boundaries**: Routers, schedulers, DB repos handle I/O
3. **No dependency injection**: Pass dependencies as direct imports, not `deps` objects
4. **Avoid premature abstraction**: Prefer direct function calls over interfaces

**Example**:
```typescript
// ✅ Correct: Pure function with direct imports
import { db } from '@alfred/db';
import { metrics } from '@alfred/metrics';

export function processEvent(event: StreamEvent): UIMessage {
  // Pure transformation
  return normalizeToUIMessage(event);
}

// ❌ Wrong: Dependency injection pattern
export function processEvent(event: StreamEvent, deps: { db: DB; metrics: Metrics }) {
  deps.metrics.increment('events'); // Side effect
  return normalizeToUIMessage(event);
}
```

### 2. Zero Allocations in Hot Loops

**Principle**: Reuse buffers, avoid spreading arrays, prefer `for` loops.

**Reference**: `.ruler/09-purity-and-performance.md` - "Zero allocations in hot loops."

**Implementation**:
- **Reuse buffers**: Pre-allocate arrays for hot paths
- **Avoid spreading**: Don't use `[...array]` in loops
- **Prefer `for` loops**: More efficient than `map`/`filter` for performance-critical code
- **Profile allocations**: Use browser DevTools to identify allocation hotspots

**Example**:
```typescript
// ✅ Correct: Reused buffer, for loop
const buffer = new Array(100);
for (let i = 0; i < items.length; i++) {
  buffer[i] = transform(items[i]);
}

// ❌ Wrong: Allocations in loop
const result = items.map(item => [...item.parts, newPart]); // Spread allocation
```

### 3. Performance Budget Enforcement

**Principle**: Budget breaches are defects.

**Reference**: `.ruler/09-purity-and-performance.md` - "Performance budget enforcement."

**Implementation**:
- **Instrument hot paths**: Use `performance.now()` timers
- **Record Prometheus histograms**: Track performance metrics
- **Emit warnings**: Log `cognitive_budget_exceeded` when budgets exceeded
- **CI enforcement**: Fail builds on budget breaches

**Example**:
```typescript
// ✅ Correct: Instrumented with budget
export function applyTransition(state: CognitiveState, event: Event) {
  const start = performance.now();
  const result = transitionLogic(state, event);
  const duration = performance.now() - start;
  
  if (duration > 0.1) { // 100 µs budget
    console.warn('cognitive_budget_exceeded', { duration });
  }
  
  cognitiveTransitionDuration.observe(duration);
  return result;
}
```

---

## Node-Based UI Architecture

### 1. React Flow (xyflow) Foundation

**Principle**: Use React Flow for spatial, node-based interface visualization.

**Reference**: `apps/web/src/components/mindscape/canvas.tsx`

**Architecture**:
- **ReactFlowProvider**: Wraps the entire canvas, provides context
- **ReactFlow**: Main canvas component, manages nodes and edges
- **NodeTypes**: Registry of node component types
- **EdgeTypes**: Custom edge renderers (e.g., `LivingEdge`)
- **State Management**: Zustand store (`useMindscapeStore`) manages node/edge state

**Implementation**:
```typescript
// Canvas setup
<ReactFlowProvider>
  <ReactFlow
    nodes={nodes}
    edges={edges}
    nodeTypes={nodeTypes}
    edgeTypes={edgeTypes}
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    onConnect={onConnect}
  >
    <Background />
    <Controls />
    <MiniMap />
  </ReactFlow>
</ReactFlowProvider>
```

### 2. Node Type System

**Principle**: Each node type is a distinct component with its own data schema.

**Reference**: `apps/web/src/components/mindscape/nodes/`

**Node Types**:
- **orb**: Central consciousness hub (400x400px, non-draggable)
- **chat**: Conversation interface (500x600px)
- **workflow**: Execution visualization
- **knowledge**: RAG document nodes
- **note/reminder/timer**: Productivity nodes
- **code/artifact**: Development artifacts
- **settings/privacy/profile**: Configuration nodes

**Implementation**:
```typescript
// Node type registry
const nodeTypes: NodeTypes = {
  orb: wrapWithErrorBoundary(OrbNode),
  chat: wrapWithErrorBoundary(ChatNode),
  workflow: wrapWithErrorBoundary(WorkflowNode),
  knowledge: wrapWithErrorBoundary(KnowledgeNode),
  // ... 20+ node types
};

// Each node wrapped with error boundary
const wrapWithErrorBoundary =
  (Component: React.ComponentType<NodeProps>) => (props: NodeProps) => (
    <NodeErrorBoundary nodeId={props.id}>
      <Component {...props} />
    </NodeErrorBoundary>
  );
```

### 3. Node Data Schemas

**Principle**: Type-safe node data using Zod schemas.

**Reference**: `apps/web/src/store/mindscape.schemas.ts`

**Implementation**:
- **Zod validation**: Each node type has a Zod schema
- **Discriminated union**: `ArtifactData` union type based on `type` field
- **Runtime validation**: Validate node data on mount/update
- **Type inference**: TypeScript types inferred from schemas

**Example**:
```typescript
// Schema definition
export const chatNodeDataSchema = z.object({
  type: z.literal("chat"),
  messages: z.array(uiMessageSchema).optional(),
  error: z.string().optional(),
});

// Type inference
export type ChatNodeData = z.infer<typeof chatNodeDataSchema> & {
  type: "chat";
};

// Discriminated union
export type ArtifactData =
  | ChatNodeData
  | WorkflowNodeData
  | KnowledgeNodeData
  | // ... all node types
```

### 4. Level of Detail (LOD) System

**Principle**: Render different detail levels based on zoom/distance.

**Reference**: `apps/web/src/components/mindscape/lod.ts`

**LOD Levels**:
- **tiny**: < 0.3 zoom - Minimal representation (colored dot)
- **small**: 0.3-0.6 zoom - Icon + label
- **medium**: 0.6-1.0 zoom - Simplified content
- **full**: > 1.0 zoom - Complete node rendering

**Implementation**:
```typescript
// LOD hook
export function useLOD(): LODLevel {
  const { zoom } = useReactFlow();
  if (zoom < 0.3) return "tiny";
  if (zoom < 0.6) return "small";
  if (zoom < 1.0) return "medium";
  return "full";
}

// Node component with LOD
export function ChatNode({ id, data }: NodeProps) {
  const lod = useLOD();
  
  if (lod === "tiny") {
    return <NodeLODTiny color="bg-purple-500" />;
  }
  if (lod === "small") {
    return <NodeLODSmall icon={<MessageSquare />} label="Chat" />;
  }
  
  return <FullChatNode data={data} />;
}
```

### 5. Living Edges

**Principle**: Edges animate based on activity state.

**Reference**: `apps/web/src/components/mindscape/living-edge.tsx`

**Edge States**:
- **Default**: `rgba(255, 255, 255, 0.2)`, 1px width, static
- **Active**: `var(--color-biolum)`, 2px width, animated flow (0.5s)
- **Highlighted**: Indigo-400, 1.5px width, slower flow (2s)

**Implementation**:
```typescript
export function LivingEdge({ id, ...props }: EdgeProps) {
  const activeEdges = useMindscapeStore(state => state.activeEdges);
  const isActive = activeEdges.has(id);
  
  let stroke = "rgba(255, 255, 255, 0.2)";
  let strokeWidth = 1;
  let animation;
  
  if (isActive) {
    stroke = "var(--color-biolum)";
    strokeWidth = 2;
    animation = "flow 0.5s linear infinite";
  }
  
  return (
    <>
      {/* Glow effect */}
      {isActive && (
        <BaseEdge {...props} style={{ strokeWidth: 6, filter: "blur(4px)" }} />
      )}
      {/* Main edge */}
      <BaseEdge {...props} style={{ stroke, strokeWidth, animation }} />
    </>
  );
}
```

### 6. Node Focus System

**Principle**: Focus system for immersive navigation.

**Reference**: `apps/web/src/store/mindscape.ts`

**Implementation**:
- **Focus state**: `focusedNodeId` in Zustand store
- **Auto-center**: `fitView` centers focused node
- **Focus transitions**: 400ms animation duration
- **Focus persistence**: Focused node highlighted with border/glow

**Example**:
```typescript
const focusAndCenter = useCallback((nodeId: string) => {
  focusNode(nodeId);
  requestAnimationFrame(() => {
    reactFlow.fitView({
      nodes: [{ id: nodeId }],
      duration: 400,
      padding: 0.4,
    });
  });
}, [focusNode, reactFlow]);
```

### 7. Node Spawning System

**Principle**: Dynamic node creation with semantic layout.

**Reference**: `apps/web/src/components/mindscape/spawn.ts`

**Spawn Types**:
- **Singleton types**: Only one instance allowed (orb, settings, profile)
- **Multiple instances**: Can spawn multiple (chat, workflow, note)
- **Semantic positioning**: New nodes positioned relative to existing nodes
- **Auto-focus**: Spawned nodes automatically focused

**Implementation**:
```typescript
export function createSpawnNode(
  spawnType: MindscapeSpawnType,
  index: number
): Node | null {
  const position = calculateSpawnPosition(spawnType, index);
  
  return {
    id: `${spawnType}-${index}`,
    type: spawnType,
    position,
    data: getDefaultData(spawnType),
  };
}

// Singleton check
if (singletonSpawnTypes.includes(spawnType)) {
  const existing = nodes.find(node => node.type === spawnType);
  if (existing) {
    focusAndCenter(existing.id);
    return existing.id;
  }
}
```

### 8. RAG Document Caching

**Principle**: Cache RAG documents for performance.

**Reference**: `apps/web/src/store/mindscape.ts` - RAG cache implementation

**Cache Strategy**:
- **TTL**: 5 minutes (`RAG_DOC_CACHE_TTL_MS`)
- **Limit**: 50 entries (`RAG_DOC_CACHE_LIMIT`)
- **LRU eviction**: Oldest entries evicted when limit reached
- **Cache stats**: Hit rate, misses, evictions tracked

**Implementation**:
```typescript
const ragDocCache = useMindscapeStore(state => state.ragDocCache);
const cachedEntry = ragDocQuery ? ragDocCache[ragDocQuery] : undefined;
const cachedRagDoc = cachedEntry && 
  Date.now() - cachedEntry.cachedAt < RAG_DOC_CACHE_TTL_MS
  ? cachedEntry.data
  : undefined;

// Cache hit/miss tracking
if (cachedRagDoc) {
  recordRagDocCacheHit();
} else {
  recordRagDocCacheMiss();
}
```

---

## State Management Patterns

### 1. Zustand Store Architecture

**Principle**: Centralized state management for Mindscape.

**Reference**: `apps/web/src/store/mindscape.ts`

**Store Structure**:
- **Nodes**: Array of React Flow nodes
- **Edges**: Array of React Flow edges
- **Focus**: `focusedNodeId` for focused node
- **RAG Cache**: Map of document ID → cached data
- **Active Edges**: Set of currently active edge IDs
- **Actions**: `onNodesChange`, `onEdgesChange`, `onConnect`, `addArtifact`, `focusNode`

**Implementation**:
```typescript
export const useMindscapeStore = create<MindscapeState>((set, get) => ({
  nodes: [],
  edges: [],
  focusedNodeId: null,
  ragDocCache: {},
  activeEdges: new Set(),
  
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(get().nodes, changes) });
  },
  
  addArtifact: (node) => {
    set({ nodes: [...get().nodes, node] });
  },
  
  focusNode: (nodeId) => {
    set({ focusedNodeId: nodeId });
  },
}));
```

### 2. Shallow Selection Pattern

**Principle**: Use shallow selection to prevent unnecessary re-renders.

**Reference**: `apps/web/src/components/mindscape/canvas.tsx`

**Implementation**:
```typescript
// ✅ Correct: Shallow selection
const { nodes, edges, focusedNodeId } = useMindscapeStore(
  useShallow((state) => ({
    nodes: state.nodes,
    edges: state.edges,
    focusedNodeId: state.focusedNodeId,
  }))
);

// ❌ Wrong: Deep selection (causes re-renders)
const state = useMindscapeStore();
```

### 3. Memoization Patterns

**Principle**: Memoize expensive computations.

**Reference**: `.ruler/12-component-development.md` - "Memoize pane item mappings with `useMemo`."

**Implementation**:
```typescript
// ✅ Correct: Memoized computation
const visibleNodes = useMemo(() => {
  return nodes.filter(node => isNodeVisible(node, viewport));
}, [nodes, viewport]);

// ✅ Correct: Stable callback
const handleNodeClick = useCallback((nodeId: string) => {
  focusAndCenter(nodeId);
}, [focusAndCenter]);
```

---

## Visual Design Language

### 1. Color System

**Principle**: OKLCH-based color system with semantic naming.

**Reference**: `apps/web/src/components/mindscape/canvas.tsx`

**Colors**:
- **Background**: `oklch(0.05 0 0)` - Deep space black
- **Biolum**: `oklch(0.99 0 0)` - White/cyan for AI
- **Void Surface**: `rgba(0, 0, 0, 0.4)` - Elevated surfaces
- **Borders**: `rgba(255, 255, 255, 0.1)` - Subtle borders

**Implementation**:
```typescript
// CSS variables
--color-biolum: oklch(0.99 0 0);
--color-void-surface: rgba(0, 0, 0, 0.4);

// Usage
<div className="bg-[oklch(0.05_0_0)] text-biolum border-white/10" />
```

### 2. Typography

**Principle**: System fonts with semantic sizing.

**Reference**: `.ruler/12-component-development.md`

**Font Sizes**:
- **H1**: 32px (2rem)
- **H2**: 24px (1.5rem)
- **Body**: 16px (1rem)
- **Small**: 14px (0.875rem)
- **Tiny**: 12px (0.75rem)

**Font Families**:
- **Primary**: System sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI"`)
- **Monospace**: `"JetBrains Mono", "Fira Code", "Consolas"`

### 3. Spacing System

**Principle**: 8px base unit system.

**Reference**: `docs/design/chat-interface-wireframe-spec.md`

**Spacing Scale**:
- **xs**: 4px (0.5 unit)
- **sm**: 8px (1 unit)
- **md**: 16px (2 units)
- **lg**: 24px (3 units)
- **xl**: 32px (4 units)

---

## Accessibility Standards

### 1. WCAG 2.1 AA Compliance

**Principle**: All interactive elements accessible.

**Reference**: `.ruler/12-component-development.md` - "Accessibility. Ship WCAG 2.1 AA interactions."

**Implementation**:
- **ARIA labels**: All interactive controls have labels
- **Keyboard navigation**: Full keyboard support
- **Focus indicators**: Visible focus states (2px solid outline)
- **Screen reader**: Proper semantic HTML and ARIA roles

**Example**:
```typescript
// ✅ Correct: Accessible button
<button
  aria-label="Clear conversation"
  className="focus:outline-2 focus:outline-[#00FF88]/50"
>
  Clear
</button>
```

### 2. Error Boundaries

**Principle**: Isolate errors at component boundaries.

**Reference**: `.ruler/12-component-development.md` - "Error boundaries."

**Implementation**:
- **Route-level**: `defaultErrorComponent` in router
- **Component-level**: `errorComponent` per route
- **Node-level**: `NodeErrorBoundary` wraps each node

**Example**:
```typescript
// Node error boundary
const wrapWithErrorBoundary =
  (Component: React.ComponentType<NodeProps>) => (props: NodeProps) => (
    <NodeErrorBoundary nodeId={props.id}>
      <Component {...props} />
    </NodeErrorBoundary>
  );
```

---

## Performance Optimization

### 1. Virtualization

**Principle**: Virtualize long lists for performance.

**Reference**: `.ruler/12-component-development.md` - "Use virtualization for long message lists."

**Implementation**:
```typescript
// ✅ Correct: Virtualized chat
<Chat
  ListComponent={Virtuoso}
  messages={messages}
  virtualized
/>

// Virtuoso configuration
<Virtuoso
  data={messages}
  itemContent={(index, message) => <Message message={message} />}
  overscan={5} // Render 5 items outside viewport
/>
```

### 2. React.memo and useCallback

**Principle**: Stabilize references to prevent re-renders.

**Reference**: `.ruler/12-component-development.md` - "Stable references."

**Implementation**:
```typescript
// ✅ Correct: Memoized component
export const OrbNode = memo((props: NodeProps) => {
  // Component implementation
});

// ✅ Correct: Stable callback
const handleNodeClick = useCallback((nodeId: string) => {
  focusAndCenter(nodeId);
}, [focusAndCenter]);
```

### 3. Physics Worker (Future)

**Principle**: Offload physics calculations to Web Worker.

**Reference**: `apps/web/src/hooks/use-physics-worker.ts`

**Implementation**:
- **Web Worker**: Physics calculations run in separate thread
- **Message passing**: State updates sent via `postMessage`
- **Performance**: Prevents main thread blocking

---

## Summary

ALFRED's design principles emphasize:

1. **Austerity**: Direct, domain-aligned code without indirection
2. **Performance**: Budget-driven development with measurement
3. **Purity**: Strict separation of pure functions and side effects
4. **Composition**: Small, single-purpose components
5. **Reality-driven**: UI reflects actual system state
6. **Accessibility**: WCAG 2.1 AA compliance
7. **Node-based UI**: Spatial interface using React Flow
8. **Type safety**: Zod schemas with TypeScript inference

These principles create a codebase that is performant, maintainable, and aligned with ALFRED's cognitive architecture.
