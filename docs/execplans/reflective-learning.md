# ExecPlan: Reflective Learning Integration

## Purpose

Implement an "Active Reflection" mechanism where Droids/Agents can reflect on their execution, learn from mistakes, and explicitly update the project's rulebook (`.ruler/`) to codify these lessons for future agents. This creates a closed-loop learning system.

## Plan

### 1. Reflection Tooling

- [x] **Design `ReflectOnTask` Tool**: Create a new tool in `packages/agent/src/orchestrator/tool/reflect.ts`.
  - **Input**: `taskId` (or runId), `outcome` (success/failure), `learnings` (string array).
  - **Action**:
    1.  Reads relevant `.ruler/` files (based on context or keywords).
    2.  Uses an LLM to synthesize the "learnings" into a concise rule format adhering to `.ruler/00-meta.md`.
    3.  Updates a specific file (e.g., `.ruler/99-learned.md`) or appends to an existing domain file.
    4.  Runs `bun run ruler:apply` to regenerate `AGENTS.md`.
  - **Evidence**: Tool exists at `packages/agent/src/orchestrator/tool/reflect.ts` with full implementation including domain mapping, file appending, and tests at `packages/agent/test/reflect-tool.test.ts`.

### 2. Workflow Integration

- [ ] **Inject Reflection Phase**: Update the Orchestrator (`packages/agent/src/orchestrator/`) to trigger a reflection step upon task completion or failure.
  - Ideally, this is a "post-act" phase or a "cleanup" phase.
  - If the task failed, the reflection prompt should ask "Why did this fail? What rule would prevent this?".
  - If the task succeeded, it might ask "Was there a surprise or workaround used? Codify it."

### 3. Agent Instructions

- [ ] **Update `AGENTS.md`**: Add a section instructing Droids that they _have_ this capability and _should_ use it. "If you encounter a non-obvious pitfall, use `ReflectOnTask` to warn future agents."

### 4. Domain-Specific Learning

- [ ] **Scoped Reflection**: Ensure reflection targets the right domain. If the task was about "Database", rules should ideally go to `.ruler/04-database.md` (or a candidate file) rather than a generic bucket.

## Progress

- [x] (2026-02-03) Design `ReflectOnTask` Tool
      Evidence: `packages/agent/src/orchestrator/tool/reflect.ts` implements `toolReflect` with input schema validation, domain mapping to `.ruler/` files, and rule appending logic. Tests exist at `packages/agent/test/reflect-tool.test.ts`.
- [ ] Workflow Integration
- [ ] Agent Instructions
- [x] (2026-02-03) Domain-Specific Learning
      Evidence: `packages/agent/src/orchestrator/tool/reflect.ts:30-41` implements `DOMAIN_MAP` that routes learnings to appropriate `.ruler/` files (e.g., database → `04-database.md`, testing → `05-testing.md`).

## Surprises & Discoveries

- (2026-02-03) Discovery: The `ReflectOnTask` tool was already implemented before this ExecPlan was created. The tool (`toolReflect`) exists at `packages/agent/src/orchestrator/tool/reflect.ts` with full functionality including domain-specific file routing, rule appending, and comprehensive test coverage.
  Evidence: `packages/agent/src/orchestrator/tool/reflect.ts` shows complete implementation; `packages/agent/test/reflect-tool.test.ts` contains 363 lines of tests covering input validation, file operations, domain mapping, and policy enforcement.

- (2026-02-03) Observation: The tool uses a simple append strategy rather than LLM-based synthesis. Rules are appended as bullet points to `.ruler/99-learned.md` or domain-specific files. This is documented as "Simple append for MVP" with a note that future implementation might use LLM merging.
  Evidence: `packages/agent/src/orchestrator/tool/reflect.ts:60-90` shows `appendRule` function that does basic string appending without LLM synthesis.

## Decision Log

- Decision: Use simple string appending for rule persistence rather than LLM-based synthesis.
  Rationale: Marked as MVP approach in code comments. Future enhancement could use LLM to merge rules intelligently, but current implementation focuses on getting learnings persisted quickly.
  Date/Author: Pre-existing / Unknown

- Decision: Domain mapping uses a hardcoded `DOMAIN_MAP` object rather than dynamic file discovery.
  Rationale: Provides deterministic routing of learnings to appropriate `.ruler/` files. Simple and maintainable, though may need expansion as new domains are added.
  Date/Author: Pre-existing / Unknown

## Outcomes & Retrospective

_(To be filled upon completion)_
