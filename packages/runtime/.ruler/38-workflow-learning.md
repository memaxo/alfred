# Workflow Learning Patterns

## Core Principle

Every workflow execution is a learning opportunity. The system must automatically capture successes, failures, and conventions to improve future planning and execution accuracy.

## Rules

1. **Terminal learning triggers.** Automatically trigger pattern and convention extraction upon workflow terminal states (completed/failed). Learning must be asynchronous and non-blocking to the primary workflow finalization.

2. **Execution aggregation.** Collect and aggregate `agent-handoff` events across all waves to generate high-fidelity execution summaries. Use these summaries instead of initial intents for learning modules to ensure fidelity to actual implementation.

3. **Pattern vs Anti-Pattern.** Store successful plans as `WorkflowPattern` templates. Store failed plans as anti-patterns with associated failure reasons to enable proactive avoidance in future generations.

4. **Contextual retrieval weights.** Prioritize in-project patterns during semantic matching. Use a 1.0x weight for same-project matches and 0.8x for cross-project fallbacks to maintain architectural consistency.

5. **Convention refinement.** Persist project-specific naming, structural, and architectural conventions extracted from successful runs into `projects.config`. Refine existing conventions incrementally rather than overwriting.

6. **Pattern lifecycle.** Implement automatic confidence decay for unused patterns (retire after 30 days) and quarantine for patterns with low success rates (<30% after 5 uses).

7. **Vector search performance.** Perform vector similarity matches directly in SQL using `pgvector` operators (`<=>`) to maintain <10ms retrieval latency. Use `CASE` expressions for contextual weighting within the query.

8. **Task enrichment.** Enrich new tasks with similar past executions, relevant heuristics, and upstream failure context using `@alfred/plan/enrich`. See `packages/agent/.ruler/enrichment-patterns.md` for details.

9. **Retry resolution tracking.** When a failed task succeeds on retry, record the resolution with `createRetryResolution()` to enable future similar-failure lookups.

10. **Structured handoffs.** Build rich wave-to-wave handoffs with `buildStructuredHandoff()` including decisions, blockers, and tools to avoid for cross-wave learning.
