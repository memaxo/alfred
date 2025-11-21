# Plan to Fix Critical Typecheck and Lint Errors

## 1. Configuration & Project Structure
**Issue**: `packages/knowledge` and `packages/rag` have `tsconfig` errors regarding `rootDir` and file inclusion. Files like `hypergraph.ts` are imported but flagged as outside root.
**Fix**:
- Check `packages/knowledge/tsconfig.json` and ensure it includes all necessary source files.
- Verify `packages/rag/tsconfig.json` references.
- Ensure circular dependencies are resolved or config allows them.

## 2. Missing Imports & Definitions
**Issue**: Several files reference missing variables or functions.
**Fix**:
- **`packages/api/src/routers/workflow.ts`**: Import `eq` and `and` from `drizzle-orm`.
- **`packages/agent/src/orchestrator/multi/spawn.ts`**: Locate `buildDepGraph` and `computeInDegree` (likely in a graph utils file) and import them, or implement if missing.
- **`packages/runtime/src/core.ts`**: Define or import `agentOutcomes`.
- **`packages/api/src/routers/graph.ts`**: Fix import path for `@alfred/agent/assistant/src/hypergraph-bridge`.

## 3. Type Safety & Null Checks
**Issue**: Strict null checks are failing in multiple files.
**Fix**:
- **`packages/knowledge/src/extractor.ts`**: Add `!` or `if` guards for nullable strings/objects.
- **`packages/knowledge/src/indices/interval-tree.ts`**: Explicitly type `parent` and `grandparent` to avoid implicit `any`. Fix `null` assignment to `Node`.
- **`packages/knowledge/src/indices/rtree.ts`**: Remove or implement missing `tighten` method on `RTreeND`.
- **`packages/agent/src/agents.ts`**: Align `PrepareStepFunction` return type with expected `PromiseLike<PrepareStepResult<ToolMap>>`.
- **`packages/agent/src/orchestrator/multi/tracker.ts`**: Add null checks for `agent`.

## 4. Voice & API Integration
**Issue**: Type mismatches in Voice modules.
**Fix**:
- **`packages/api/src/routers/voice.ts`** & **`packages/api/src/voice/pools.ts`**: The `STTPool` and `TTSPool` types seem to lack `activeCount` and `size` properties. Check the class definitions and expose these properties or use the correct accessor.
- **`packages/voice/src/stream.ts`**: `SharedArrayBuffer` is not assignable to `ArrayBuffer`. Cast it or use a compatible type.

## 5. Linting & Code Style (Low Priority)
**Issue**: Shadowing, Magic Numbers, Unknown At-Rules.
**Fix**:
- **`apps/native/components/sign-in.tsx`**: Rename shadowed `error` variable.
- **`scripts/test-tts.ts`**: Extract magic numbers to constants.
- **`apps/native/global.css`**: Ignore Tailwind v4 warning or adjust VSCode settings (if relevant).

## Execution Order
1. Fix `tsconfig` issues first to reduce noise.
2. Fix "Missing Imports" as they block compilation.
3. Fix "Type Safety" errors file by file.
4. Run `bun run typecheck` to verify.
5. Address Lint issues if time permits or if they block the build.
