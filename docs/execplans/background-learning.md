# Constant Background Learning

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will implement "Constant Background Learning," allowing ALFRED to automatically extract and persist knowledge from every interaction (Chat, Workflow) without explicit user commands or agent tool calls. This creates a "subconscious" memory loop where the system "dreams" on past conversations to enrich its Knowledge Graph.

The implementation uses an asynchronous background worker pattern to ensure zero latency impact on the user's critical path.

## Progress

- [ ] **Database Schema**
    - [ ] Add `learned_at` column to `workflow_runs` table to track learning progress.
    - [ ] Create migration SQL.
- [ ] **Learning Worker**
    - [ ] Create `packages/agent/src/orchestrator/learning-worker.ts`.
    - [ ] Implement `poll()` loop to fetch unlearned runs.
    - [ ] Implement `processRun()` to route extraction based on workflow type (`assistant` vs `orchestrator`).
    - [ ] Integrate `extract()` and `toKnowledge()` from `@alfred/knowledge`.
    - [ ] Persist results via `upsertNodes`/`upsertEdges`.
- [ ] **Integration**
    - [ ] Initialize `startLearningWorker()` in `packages/api/src/init.ts`.
    - [ ] Add environment variable `ENABLE_LEARNING_WORKER=1` to control activation.
- [ ] **Testing**
    - [ ] Create `packages/agent/test/learning-worker.integration.test.ts`.
    - [ ] Verify end-to-end flow: Create Run -> Wait -> Verify Graph Node exists.

## Surprises & Discoveries

*(Populate during execution)*

## Decision Log

- **Architecture**: Chosen "Pull" model (Worker polling DB) over "Push" model (Event Bus) because persistence is the source of truth, and we want durability across restarts. If the server crashes, the worker simply resumes from the last unlearned run.

## Outcomes & Retrospective

*(Populate during execution)*

## Context and Orientation

-   **Source of Truth**: `workflow_runs` table in Postgres contains all interaction history.
-   **Extraction Logic**: `packages/knowledge/src/extractor.ts` (implemented in previous phase).
-   **Worker Host**: `packages/api` runs the server, so it will spawn the worker. The worker logic resides in `packages/agent` to stay close to the orchestrator domain.

## Plan of Work

### 1. Database Migration
We need a cursor to know which runs have been processed.
-   **Edit**: `packages/db/src/schema/workflow.ts` to add `learnedAt` timestamp.
-   **Run**: `bun run db:migrate` (after creating the SQL file).

### 2. The Worker (`packages/agent`)
We will create a robust worker that:
1.  Finds `workflow_runs` where `status = 'completed'` AND `learned_at IS NULL`.
2.  Batches them (e.g., 10 at a time).
3.  Extracts knowledge from `input_data` (User) and `event_data` (Agent output).
4.  Updates `learned_at`.

### 3. Integration (`packages/api`)
Wire the worker into the server startup sequence, gated by an env var for safety.

### 4. Testing
We will write a "slow" integration test that:
1.  Inserts a completed run into the DB.
2.  Starts the worker.
3.  Polls the Graph DB until a specific Fact appears.

## Concrete Steps

### Step 1: Schema
```typescript
// packages/db/src/schema/workflow.ts
export const workflowRuns = pgTable("workflow_runs", {
  // ... existing
  learnedAt: timestamp("learned_at"),
});
```

### Step 2: Worker Implementation
```typescript
// packages/agent/src/orchestrator/learning-worker.ts
export async function runLearningCycle() {
  const runs = await db.query.workflowRuns.findMany({
    where: and(eq(status, "completed"), isNull(learnedAt)),
    limit: 10
  });
  for (const run of runs) {
    await learnFromRun(run);
    await markLearned(run.id);
  }
}
```

### Step 3: Integration Test
```typescript
test("background learning extracts facts", async () => {
  await createCompletedRun("I live in Paris");
  await runLearningCycle(); // Manual trigger
  const facts = await graph.search("Paris");
  expect(facts).toHaveLength(1);
});
```
