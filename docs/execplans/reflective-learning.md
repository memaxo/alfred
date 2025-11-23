# ExecPlan: Reflective Learning Integration

## Purpose
Implement an "Active Reflection" mechanism where Droids/Agents can reflect on their execution, learn from mistakes, and explicitly update the project's rulebook (`.ruler/`) to codify these lessons for future agents. This creates a closed-loop learning system.

## Plan

### 1. Reflection Tooling
- [ ] **Design `ReflectOnTask` Tool**: Create a new tool in `packages/agent/src/orchestrator/tool/reflect.ts`.
    - **Input**: `taskId` (or runId), `outcome` (success/failure), `learnings` (string array).
    - **Action**: 
        1.  Reads relevant `.ruler/` files (based on context or keywords).
        2.  Uses an LLM to synthesize the "learnings" into a concise rule format adhering to `.ruler/00-meta.md`.
        3.  Updates a specific file (e.g., `.ruler/99-learned.md`) or appends to an existing domain file.
        4.  Runs `bun run ruler:apply` to regenerate `AGENTS.md`.

### 2. Workflow Integration
- [ ] **Inject Reflection Phase**: Update the Orchestrator (`packages/agent/src/orchestrator/`) to trigger a reflection step upon task completion or failure.
    - Ideally, this is a "post-act" phase or a "cleanup" phase.
    - If the task failed, the reflection prompt should ask "Why did this fail? What rule would prevent this?".
    - If the task succeeded, it might ask "Was there a surprise or workaround used? Codify it."

### 3. Agent Instructions
- [ ] **Update `AGENTS.md`**: Add a section instructing Droids that they *have* this capability and *should* use it. "If you encounter a non-obvious pitfall, use `ReflectOnTask` to warn future agents."

### 4. Domain-Specific Learning
- [ ] **Scoped Reflection**: Ensure reflection targets the right domain. If the task was about "Database", rules should ideally go to `.ruler/04-database.md` (or a candidate file) rather than a generic bucket.

## Progress
- [ ] Design `ReflectOnTask` Tool
- [ ] Workflow Integration
- [ ] Agent Instructions
- [ ] Domain-Specific Learning

## Surprises & Discoveries
*(To be filled during execution)*

## Decision Log
*(To be filled during execution)*

## Outcomes & Retrospective
*(To be filled upon completion)*
