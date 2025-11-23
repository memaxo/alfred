# ExecPlan: Mindscape LOD Parity

**Status**: Proposed
**Goal**: Achieve complete visual consistency across the Mindscape by implementing Semantic LOD (Level of Detail) for all 15+ node types.

## Context
We have successfully implemented polymorphic LOD (Tiny/Small/Medium/Full) for core nodes: `NoteNode`, `OrbNode`, `WorkflowNode`. However, many other node types (`Knowledge`, `Settings`, `Profile`, `Device`, `Memory`, etc.) still use static or incomplete renderings, breaking the immersion when zooming.

## Scope
All nodes must implement the `useLOD()` pattern:
1.  **Tiny**: A colored dot/pixel (minimal DOM).
2.  **Small**: Icon + truncated label.
3.  **Medium**: Condensed card (summary).
4.  **Full**: Interactive card (full controls).

## Target Nodes
- `KnowledgeNode` (Concepts, Facts)
- `SettingsNode` (Config toggles)
- `ProfileNode` (User stats)
- `DeviceNode` (Hardware status)
- `MemoryNode` (Stored context)
- `TopicNode` (Clustered themes)
- `ImageNode` (Media previews)
- `CodeNode` (Snippets)

## Implementation Steps

1.  **Audit**: List all registered node types in `canvas.tsx` / `nodeTypes`.
2.  **Component Refactor**: For each missing type:
    - Import `useLOD`.
    - Define the 4 render variants.
    - Apply `useNodeFocus` for focus states.
3.  **Style Unification**: Ensure all "Tiny" and "Small" variants share exact dimensions/styles across types to prevent visual "popping" during layout shifts.
4.  **Performance Check**: Verify that "Tiny" variants are essentially just `div`s with `backgroundColor`, avoiding expensive sub-renders.

## Verification
- **Manual**: Zoom in/out on a diverse graph containing all node types.
- **Automated**: Expand E2E test `The Diver` to check class names of different node types at various zoom levels.
