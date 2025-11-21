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

export type UnifiedNodeRef = {
  uiId?: string;
  dbId?: string;
  hgHash?: string;
};

export type UnifiedNode = {
  id: UnifiedNodeRef;
  kind: UnifiedNodeKind;
  label: string;
  properties?: Record<string, unknown>;
};

export type UnifiedEdge = {
  id?: string;
  source: UnifiedNodeRef;
  target: UnifiedNodeRef;
  kind: string;
  weight?: number;
  properties?: Record<string, unknown>;
};

export type ResourceScope = string;
