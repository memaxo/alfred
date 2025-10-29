# Naming Conventions

## Core Principles

- **Austerity.** Every name directly serves the domain. No ceremony, no indirection.
- **Performance.** Names must be short to minimize memory allocation and hash computation.
- **Cognition.** Names reflect cognitive states and domain concepts, not implementation details.

## Rules

1. **Single-word names.** Files, directories, exported symbols, and route segments must remain a single lowercase word (e.g. `remind.ts`, `policy`, `note`). Use suffixes only when required by tools (`.test.ts`, `.spec.ts`).

   **Framework and UI exceptions (limited):**
   - TanStack Start reserved files: `_layout.tsx`, `+not-found.tsx`, route loader/action filenames the framework mandates.
   - React / React Native ergonomics in UI packages: conventional hook/component prefixes or platform hints are allowed (e.g. `use-color-scheme.ts`, `android-navigation-bar.tsx`, `header-button.tsx`, `sign-in.tsx`, `sign-up.tsx`).
   - Generated outputs that land outside `apps/*/src` and `packages/*/src` may follow the generator's naming.
   Outside these cases, keep names to a single word.

2. **Domain folders.** Group behaviour under domain nouns (`note`, `remind`, `timer`, `book`). Avoid verbs or multi-word folders (`create-note`, `assistant-notes`).
   
   **Cognitive domains (core):**
   - `cognitive` - State machine and transitions
   - `knowledge` - Hypergraph and queries
   - `learning` - Self-supervision and error analysis
   - `metrics` - Performance and cognitive load
   - `focus` - Attention and productivity states
   - `capture` - Input processing and understanding
   - `synthesis` - Knowledge integration
   - `execution` - Action planning and execution
   - `reflection` - Error analysis and improvement

3. **Schema and repo parity.** Table names, Drizzle schemas, and repository helpers must share the same single-word root. Do not invent aliases between layers.

4. **Migrations.** Migration filenames must follow `NNNN_description.sql` with `description` as a single word. Comments inside migrations may explain details.

5. **Generated outputs.** Artifacts produced by tools (Ruler, Drizzle, Turbo) can use the tool's default naming. Keep them out of `apps/*/src` and `packages/*/src` when they violate the rule.

6. **Tests.** Co-locate tests next to the unit under test or in the nearest `__tests__` folder. Use `<name>.test.ts` or `<name>.spec.ts`.

7. **Performance files.** Hot paths must have `.hot.ts` suffix for easier profiling. Example: `transition.hot.ts`, `query.hot.ts`.

8. **Type files.** Pure type definitions use `.types.ts` suffix. These files contain zero runtime code.

9. **Measurement points.** Functions that must meet performance budgets get prefixed with `fast_` (< 1ms), `quick_` (< 10ms), or unmarked (best effort).

## Cognitive Domain Terminology

### State Types (use as prefixes/suffixes)
- `idle` - Waiting state
- `thinking` - Processing/analyzing
- `deciding` - Choosing between options
- `acting` - Executing plan
- `learning` - Self-supervision active

### Knowledge Types
- `fact` - Atomic knowledge unit
- `relation` - Connection between facts
- `insight` - Derived knowledge
- `query` - Knowledge request
- `graph` - Knowledge structure

### Performance Indicators
- `hot` - Performance critical path
- `cold` - Rarely accessed
- `cache` - Memoized results
- `index` - Search optimization

### Tool Categories
- `sense` - Input tools (web, voice)
- `think` - Processing tools (plan, analyze)
- `act` - Output tools (execute, respond)
- `learn` - Improvement tools (feedback, correct)

## File Examples

```
packages/
  cognitive/
    state.ts          # CognitiveState type definitions
    transition.hot.ts # State machine (performance critical)
    flows.ts          # Capture/Synthesis/Execution/Reflection
  knowledge/
    graph.ts          # Hypergraph implementation
    query.hot.ts      # Query engine (performance critical)
    index.ts          # HAMT/BTree/RTree indices
  learning/
    supervise.ts      # Self-supervision loop
    mistake.ts        # Error ledger
  metrics/
    performance.ts    # Nanosecond timing
    cognitive.ts      # Load tracking
```

## Naming Performance Requirements

- Function names: max 20 characters
- Variable names: max 15 characters  
- No allocations in name lookups (use interned strings where possible)
- Prefer single character names in hot loops: `i`, `n`, `k`, `v`
- Use numeric suffixes instead of descriptive ones in performance code: `state1`, `state2` not `oldState`, `newState`

## Banned Patterns

- ❌ `createUserAccount` → ✅ `account`
- ❌ `processKnowledgeGraph` → ✅ `graph`
- ❌ `CognitiveStateManager` → ✅ `cognitive`
- ❌ `PerformanceMonitoringService` → ✅ `metrics`
- ❌ `async_await_handler` → ✅ `handle`
