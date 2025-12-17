export type NodeIdRef = {
  /** UUID primary key of `memory_nodes.id`. */
  dbId?: string;
  /** Content-addressed hypergraph hash (and often `memory_nodes.hash` for knowledge-backed nodes). */
  hgHash?: string;
  /** UI-only identifier (e.g. React Flow node id). */
  uiId?: string;
};

export type NodeRef = {
  id: NodeIdRef;
  /** Resource namespace for graph and retrieval scoping (e.g. "user", `rag:<source>`, `runtime:<runId>`). */
  resource: string;
};
