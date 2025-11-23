# Emergent Intelligence Architecture

Owner: cognition

## Overview

Alfred's "Emergent Intelligence" is the system by which the assistant dynamically adapts its persona, tools, and knowledge retrieval based on the latent context of the conversation. Instead of rigid classifiers, it uses a **Vector-Graph Hybrid** approach to discover relationships between user inputs and abstract "Anchor Concepts" (e.g., Coding, Security, Politics).

## Core Components

### 1. Vector-Native Entity Linking
Traditional entity linking relies on exact string matching, which fails on synonyms or fuzzy inputs. Alfred uses `pgvector` to embed extracted entities and find their nearest neighbors in the Knowledge Graph.

- **Input**: "I'm debugging a segfault"
- **Extraction**: "debugging", "segfault"
- **Embedding**: `[0.01, -0.5, ...]` (1024 dim)
- **Vector Search**: Finds `Node:C++` or `Node:Linux` based on semantic similarity.

### 2. Graph Propagation (Recursive CTEs)
Once an entity is located in the graph, a recursive SQL query (Common Table Expression) traverses the graph edges to find the nearest "Anchor Concept".

```sql
WITH RECURSIVE traversal AS (
  -- Base Case: Start at the linked node
  SELECT id, 0 as depth, ARRAY[id] as path FROM memory_nodes WHERE id = ...
  UNION ALL
  -- Recursive Step: Follow edges
  SELECT t.to_id, d.depth + 1, path || t.to_id
  FROM memory_edges e
  JOIN traversal d ON e.from_id = d.id
  WHERE d.depth < 5
)
SELECT * FROM traversal WHERE node_type = 'anchor' LIMIT 1;
```

This allows "React" to activate "Coding" through the path: `React -> Frontend -> Coding`.

### 3. Adaptive Persona
The detected Anchor Concepts trigger specific system instructions (Personas).
- **Coding**: "You are a Senior Software Engineer. Prioritize terse, efficient code."
- **Security**: "You are an Ethical Hacker. Warn about vulnerabilities."

If multiple concepts are active (e.g., "Python script for network scanning"), Alfred merges the personas: "Senior Engineer + Ethical Hacker".

### 4. Mindscape Visualization
The traversal paths are returned to the frontend and visualized in the "Mindscape" - a 3D force-directed graph.
- **Active Path**: Glowing edges show the cognitive trace.
- **Decay**: Paths fade out over time (10s) if not reinforced.

## Performance

- **Entity Linking**: < 10ms (HNSW Index)
- **Graph Traversal**: < 5ms (Recursive CTE, limited depth)
- **Total Latency**: < 50ms per message

## Database Schema

`memory_nodes` table:
- `embedding`: `vector(1024)` (KaLM-Embedding-Gemma3-12B-2511)
- `label`: Text label
- `kind`: `fact` | `anchor` | `cluster`

## Future Improvements

- **Confidence Scores**: Weigh edges to calculate confidence of the inferred domain.
- **Pruning**: Decay unused edges to keep the graph relevant.
- **Feedback Loop**: User corrections ("That's not about coding") update edge weights.
