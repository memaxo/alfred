# Knowledge Graph Patterns

1. **Emergent Intelligence.** Derive classification and intent from graph topology (distance to Anchor Nodes) rather than probabilistic classifiers. Intelligence emerges from connection density, not model predictions.

2. **Recursive SQL.** Use PostgreSQL Recursive CTEs for all graph traversals (pathfinding, propagation). Push traversal logic to the database to minimize data transfer and leverage the query planner.

3. **Anchor Nodes.** Seed the graph with immutable "Anchor Concepts" (e.g., `concept:coding`, `concept:security`) that serve as the fixed coordinate system for relative classification.

4. **Entity Linking.** Graph entry points must support fuzzy matching (substring, case-insensitive). Never rely on exact string matching to bridge unstructured text to structured nodes.

5. **Synchronous Extraction.** Keep knowledge extraction pipelines synchronous and heuristic-based (NLP) in the hot path. Defer embeddings and LLM-based synthesis to background workers.
