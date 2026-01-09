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
  // biome-ignore lint/suspicious/noExplicitAny: Unified node properties can have any shape
  properties?: Record<string, any>;
};

export type UnifiedEdge = {
  id?: string;
  source: UnifiedNodeRef;
  target: UnifiedNodeRef;
  kind: string;
  weight?: number;
  // biome-ignore lint/suspicious/noExplicitAny: Unified edge properties can have any shape
  properties?: Record<string, any>;
};

export type ResourceScope = string;
