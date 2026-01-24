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

State: `idle`, `thinking`, `deciding`, `acting`, `learning`.
Knowledge: `fact`, `relation`, `insight`, `query`, `graph`.
Performance: `hot`, `cold`, `cache`, `index`.
Tools: `sense`, `think`, `act`, `learn`.

## Naming Performance Requirements

- Names: Functions ≤ 20 chars, variables ≤ 15 chars.
- Hot loops: No allocations in lookups; use single chars (`i`, `n`, `k`, `v`) and numeric suffixes (`state1`).
