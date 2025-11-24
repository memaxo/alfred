import { and, eq } from "drizzle-orm";
import { memoryEdges } from "../../schema/graph";
import type { EdgeRow, NodeRow } from "./types";

export function sanitize<T extends Record<string, unknown>>(
  input: Partial<T>
): Partial<T> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next as Partial<T>;
}

export function buildEdgeWhere(
  field: typeof memoryEdges.fromId | typeof memoryEdges.toId,
  nodeId: string,
  kind?: string
) {
  return kind
    ? and(eq(field, nodeId), eq(memoryEdges.kind, kind))
    : eq(field, nodeId);
}

export function uniqSeeds<T extends { resource: string; hash: string }>(
  seeds: T[]
): T[] {
  if (seeds.length === 0) {
    return seeds;
  }
  const seen = new Set<string>();
  const list: T[] = [];
  for (const seed of seeds) {
    const key = `${seed.resource}:${seed.hash}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    list.push(seed);
  }
  return list;
}

export function parseJsonRecord(
  value: unknown
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeNode(row: NodeRow): NodeRow {
  const props = parseJsonRecord(row.properties);
  return props === row.properties ? row : { ...row, properties: props };
}

export function normalizeEdge(row: EdgeRow): EdgeRow {
  const metadata = parseJsonRecord(row.metadata);
  return metadata === row.metadata ? row : { ...row, metadata };
}

export const numberFromProps = (
  props: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number
): number => {
  if (!props) {
    return fallback;
  }
  const value = props[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

export const stringFromProps = (
  props: Record<string, unknown> | null | undefined,
  key: string
): string | null => {
  if (!props) {
    return null;
  }
  const value = props[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
};
