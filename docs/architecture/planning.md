# Planning Architecture

## Overview
ALFRED's planning system transforms natural language intents into structured execution plans. It operates in multiple phases: Intent Parsing, Research, Generation, and Evaluation.

## Phase 1: Intent Parsing
Located in `@alfred/plan/intent`.

### Structured Intent
User input is parsed into a `WorkflowIntent` object. This process handles:
- **Ambiguity Detection**: Using AI to score intent clarity and generate clarification questions.
- **Multi-Intent Splitting**: Separating composite requests into individual sub-intents.
- **Context Enrichment**: Attaching workspace, codebase, and pattern context.

### Pattern: Recursive Zod Schemas
When defining `WorkflowIntent`, use `z.lazy()` and explicit type annotations for recursive structures:
```typescript
export const workflowIntentSchema: z.ZodType<any> = z.object({
  // ...
  multiIntent: z.object({
    split: z.boolean(),
    intents: z.array(z.lazy(() => workflowIntentSchema)),
  }).optional(),
});
```

## Phase 2: Planning
Located in `@alfred/plan/generate`.
- **Research**: Aggregating information from the codebase (`gatherCodeContext`) and external sources (Exa v2 Aggregator).
- **Generation**: Creating `StructuredPlan` objects with `Phases` and `SubTasks`.
- **Evaluation**: Verification-first evaluation using deterministic checks (typecheck, tests, build) and LLM critiques.

## Phase 3: Visual Management
Located in `apps/web/src/components/windows/workflow/`.
- **Canvas Visualization**: Interactive DAG rendering using React Flow.
- **Pre-execution Review**: Manual approval gate for all generated plans.
- **Interactive Editing**: Support for drag-and-drop dependency management and phase refinement.
- **State Sync**: Real-time synchronization between visual edits and the underlying `StructuredPlan` schema.
