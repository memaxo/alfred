import type { memoryEdges, memoryNodes } from "../../schema/graph";

export type NodeInsert = typeof memoryNodes.$inferInsert;
export type NodeRow = typeof memoryNodes.$inferSelect;
export type EdgeRow = typeof memoryEdges.$inferSelect;

export type NodeSeed = {
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties?: unknown;
  embedding?: number[];
};

export type EdgeSeed = {
  resource: string;
  hash: string;
  fromId: string;
  toId: string;
  kind: string;
  weight?: number;
  metadata?: unknown;
};
