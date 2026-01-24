# ExecPlan: The Loom V2 (Web Worker Physics)

**Status**: Proposed
**Goal**: Decouple Mindscape physics calculations from the main thread to support 1000+ nodes at 60fps.

## Context

The current `layout-semantic.ts` runs on the main thread. While optimized (<1ms for 100 nodes), it shares resources with React rendering, event handling, and other UI tasks. Scaling to "Starfield" sizes (1000+ nodes) requires dedicated parallel execution.

## Architecture

### 1. The Worker (`apps/web/src/workers/physics.worker.ts`)

- **Responsibilities**:
  - Manage the entire simulation state (node positions, velocities).
  - Execute force calculations (Repulsion, Spring, Focus Gravity, Semantic Zones).
  - Handle collision detection (optional, expensive).
- **Communication**:
  - **In**: `UPDATE_NODES` (new/removed nodes), `UPDATE_FOCUS` (focus target changed), `UPDATE_CONFIG` (gravity strength, etc.).
  - **Out**: `TICK` (Float32Array of positions). Using `SharedArrayBuffer` or `Transferable` arrays is preferred for zero-copy overhead.

### 2. The Bridge (`apps/web/src/lib/mindscape/physics-bridge.ts`)

- Wraps the Worker instantiation and communication.
- Provides a clean API for React components (`usePhysics()`).
- Handles graceful fallback if Workers are unavailable (rare, but good practice).

### 3. Integration

- **Canvas**: The `Canvas` component subscribes to the bridge.
- **Render Loop**: `requestAnimationFrame` triggers a read from the bridge's latest state rather than calculating it.

## Implementation Steps

1.  **Create Worker**: Move `layout-semantic.ts` logic into `physics.worker.ts`.
2.  **Protocol Definition**: Define typed messages for `Main -> Worker` and `Worker -> Main`.
3.  **Buffer Optimization**: Implement `Float32Array` serialization for position updates to minimize serialization cost.
4.  **React Hook**: Create `usePhysicsWorker()` to manage the worker lifecycle and state syncing.
5.  **Migration**: Switch `MindscapeCanvas` to use the worker bridge.

## Performance Targets

- **Budget**: Physics tick < 8ms (120Hz target) in worker.
- **Latency**: Main thread sync < 1ms.
- **Capacity**: 1000+ nodes with stable 60fps UI.

## Verification

- **Benchmark**: `apps/web/tests/physics-benchmark.html` (manual) or performance test script.
- **Visual**: Focus mode transitions remain smooth under load.
