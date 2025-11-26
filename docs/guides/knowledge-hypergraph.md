# Knowledge Hypergraph

**Owner:** Knowledge  
**Last Updated:** 2025-11-26

## Purpose

This guide explains ALFRED's knowledge representation system—a hypergraph that captures facts, relations, insights, and patterns as first-class citizens, enabling rich semantic queries and emergent understanding over time.

---

Memory is the foundation of intelligence. Without the ability to retain, organize, and retrieve information, even the most sophisticated reasoning systems reduce to stateless pattern matchers. ALFRED's knowledge hypergraph addresses this challenge by providing a persistent, queryable representation of everything the assistant learns—from atomic facts to complex patterns that span multiple domains.

The choice of a hypergraph over simpler alternatives reflects ALFRED's need to capture not just what it knows, but how that knowledge connects. Traditional relational databases excel at structured, tabular data but struggle with the fluid, interconnected nature of knowledge. Vector databases enable semantic similarity search but lose the structural relationships that give facts meaning. ALFRED's hypergraph provides both: semantic richness through embeddings and structural clarity through explicit relations.

## Core Concepts

The hypergraph organizes knowledge into four fundamental types, each serving a distinct purpose in ALFRED's cognitive architecture. Facts represent atomic units of information—statements that can be true or false, with associated confidence scores and provenance. Relations capture connections between facts, encoding how concepts relate to each other through typed, weighted edges. Insights emerge from multiple facts through inference, representing conclusions that ALFRED has derived rather than directly observed. Patterns abstract over collections of similar experiences, encoding rules that predict future behavior.

Content addressing ensures that each piece of knowledge has a unique, deterministic identifier derived from its content. This eliminates duplicates automatically: if ALFRED encounters the same fact twice, it resolves to the same node in the hypergraph. Content addressing also enables efficient lookup—given any piece of knowledge, its identifier can be computed without querying the database. The implementation uses a fast hash function (FNV-1a) optimized for string inputs, producing compact identifiers suitable for indexing.

Temporal awareness pervades the hypergraph design. Every fact carries a timestamp recording when it was learned. An interval tree index enables efficient temporal queries—finding all facts learned within a time range, or tracking how knowledge has evolved over time. This temporal dimension is essential for forgetting: without knowing when facts were learned and last accessed, ALFRED couldn't implement the memory decay that prevents unbounded growth.

## Architecture

The hypergraph implementation prioritizes memory efficiency and query performance through careful data structure selection. At its core, a Hash Array Mapped Trie (HAMT) provides O(1) content-addressed storage with excellent cache locality. The HAMT distributes nodes across 256 buckets based on hash prefixes, enabling efficient iteration without the overhead of traditional hash table resizing.

Relation traversal uses adjacency lists stored in both directions. The `edges` map tracks outbound relations from each node, while `inbound` tracks incoming relations. This bidirectional indexing supports traversals in either direction without expensive graph scans. Additional indexes by relation kind enable filtered traversals—finding only "depends-on" relations from a node, for example, without examining unrelated edges.

Spatial indexing through an R-tree enables nearest-neighbor queries over embeddings. When ALFRED needs to find knowledge semantically similar to a query, it projects the query into embedding space and uses the R-tree to efficiently locate nearby nodes. The R-tree implementation uses a configurable branching factor (default 1024) that balances tree depth against node size for typical knowledge base scales.

The B-tree index maintains ordered access to facts by content, supporting range queries and prefix matching. While less frequently used than the HAMT or spatial indexes, B-tree queries enable administrative operations like finding all facts containing a specific term without requiring full graph scans.

## Active Recall and Memory Decay

Human memory strengthens through retrieval—the act of recalling information reinforces the neural pathways that encode it. ALFRED implements this principle through active recall: when the hypergraph retrieves a node, it updates that node's access timestamp, effectively "touching" the memory. Frequently accessed knowledge remains fresh while unused facts gradually fade.

Memory decay follows a forgetting curve inspired by psychological research. Each fact's effective strength decays exponentially with time since last access, but the decay rate itself adapts based on the fact's retrieval history. Facts that have been recalled multiple times decay more slowly than facts accessed only once—a phenomenon called spaced repetition that models how stable memories form through reinforcement.

Safety rails prevent decay from destroying valuable knowledge. A minimum confidence floor ensures that facts never decay below a threshold where they might be erroneously pruned. Similarly, facts marked as foundational or manually confirmed are exempt from automatic decay. The decay system also respects explicit invalidation: when ALFRED learns that a fact is false, it's marked invalid rather than merely low-confidence, preventing accidental resurrection through recall.

Maintenance workers run periodically to apply decay and prune low-confidence nodes. These workers operate during low-activity periods to minimize impact on query performance. Prometheus metrics track decay operations, enabling operators to tune decay rates based on observed knowledge base growth and query patterns.

## Hybrid Search

Semantic search alone misses structural relationships that give knowledge meaning. Knowing that two concepts are semantically similar doesn't reveal that one causes the other, or that they share a common ancestor. ALFRED's hybrid search combines vector similarity with graph traversal to deliver results that are both semantically relevant and structurally connected.

The search process begins with semantic retrieval: the query is embedded and the R-tree identifies the K most similar nodes by vector distance. These seeds represent the semantic core of the search—the concepts most closely related to the query in meaning. But seeds alone may miss critical context.

Graph expansion enriches seeds with structural neighbors. For each seed, the search traverses outbound relations to find connected concepts, weighting results by both relation strength and semantic similarity to the query. This expansion surface can include predecessors (what does this fact depend on?), successors (what depends on this fact?), and siblings (what else relates to the same parent?).

Reranking scores the combined result set against the original query, balancing semantic similarity with structural relevance. A fact that is semantically distant but structurally critical (like a root cause or key dependency) may rank higher than a semantically similar but isolated fact. The final ranked list provides the context that downstream components use for reasoning and generation.

## Design Decisions

The hypergraph model was chosen over pure vector databases because ALFRED needs to understand relationships, not just similarity. When a user asks about deploying to production, ALFRED shouldn't just find semantically similar content—it should understand that deployment requires code review, that production differs from staging, and that certain approvals are prerequisites. These structural relationships are first-class citizens in the hypergraph but invisible to embedding-only approaches.

Content addressing provides automatic deduplication without coordination. As ALFRED learns from multiple sources—conversations, documents, observations—duplicate facts naturally coalesce to the same nodes. This convergence is essential for building coherent knowledge: without it, ALFRED might maintain contradictory copies of the same fact, or fail to recognize that information from different sources refers to the same concept.

The choice to implement indices (HAMT, R-tree, B-tree, interval tree) from scratch rather than using external libraries reflects performance requirements. These data structures are on the critical path for every query, and generic implementations often sacrifice performance for flexibility ALFRED doesn't need. The custom implementations are tuned for ALFRED's specific access patterns and type constraints.

## Integration Points

The RAG pipeline consumes hypergraph queries to build context for generation. When ALFRED prepares a response, it queries the hypergraph for facts related to the user's request, recent conversation context, and learned patterns that might inform the response. These facts are serialized into the prompt, providing grounded knowledge that reduces hallucination.

The cognitive loop writes reflection outcomes to the hypergraph as insights. When ALFRED compares expected versus actual results, the comparison itself becomes knowledge—a record of what worked, what failed, and why. These insights accumulate into patterns that inform future behavior, closing the loop between experience and learning.

Tool execution queries the hypergraph for domain-specific context. Before ALFRED executes a Git operation, for example, it queries for facts about the repository's conventions, past issues with similar operations, and user preferences for Git workflows. This contextual grounding ensures that tools operate with awareness of the specific environment.

The Mindscape UI visualizes the hypergraph as an interactive graph. Users can explore their knowledge base, see how concepts connect, and understand why ALFRED made particular decisions. This transparency builds trust and enables users to correct misunderstandings before they propagate.

## Related Documentation

- [Architecture Overview](../architecture/overview.md) — System-wide architecture context
- [Cognitive State Machine](cognitive-state-machine.md) — How cognitive state feeds into knowledge
- [Learning System](learning-system.md) — How insights and patterns are extracted
- [Integration Patterns](integration-patterns.md) — How knowledge composes with other systems

