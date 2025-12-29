# Memory Lifecycle Patterns

## Core Principle

Memory nodes decay exponentially. Archive low-confidence nodes. Active retrieval boosts confidence via touch.

## Rules

1. **Memory decay.** Apply exponential decay with `MEMORY_DECAY_FACTOR`. Nodes decay faster when not accessed. Decrease confidence over time.

2. **Pruning threshold.** Archive nodes when confidence < `MEMORY_PRUNE_CONFIDENCE`. Never automatically delete—archive for potential recovery.

3. **Active recall touch.** Call `touchNodes(nodeIds)` after retrieval. Reset decay timer. Boost confidence by 0.05.

4. **Confidence initialization.** Set initial confidence (0.0-1.0) on memory creation. High confidence for user-created, low for inferred.

5. **Decay calculation.** Calculate decay based on time elapsed since last access. Use exponential formula: `confidence *= factor^elapsedTime`.

6. **Archive separation.** Store archived nodes separately from active nodes. Exclude from default retrieval queries.

7. **Restoration threshold.** Restore archives when re-accessed exceeds confidence threshold. Set decay timer from restoration.

8. **Policy integration.** Expose `memoryConfidence` to policy evaluation. Block high-risk actions when using low-confidence memories.

## See Also

- `.ruler/03-security.md` for security expectations
