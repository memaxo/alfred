export type UnifiedNodeKind =
  | "fact"
  | "insight"
  | "pattern"
  | "relation"
  | "ui"
  | "workflow"
  | "note"
  | "reminder"
  | "ticket"
  | "code"
  | "artifact"
  | "other"
  | (string & Record<never, never>);

export interface UnifiedNodeRef {
  uiId?: string;
  dbId?: string;
  hgHash?: string;
}

export interface UnifiedNode {
  id: UnifiedNodeRef;
  kind: UnifiedNodeKind;
  label: string;
  // oxlint-disable noExplicitAny: Unified node properties can have any shape
  properties?: Record<string, any>;
}

export interface UnifiedEdge {
  id?: string;
  source: UnifiedNodeRef;
  target: UnifiedNodeRef;
  kind: string;
  weight?: number;
  // oxlint-disable noExplicitAny: Unified edge properties can have any shape
  properties?: Record<string, any>;
}

export type ResourceScope = string;
