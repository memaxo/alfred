import { db, graphSchema } from "@alfred/db";
import { and, desc, eq, inArray } from "drizzle-orm";

const { memoryNodes } = graphSchema;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const REFLECTION_KIND = "insight";

type MemoryNodeRow = typeof memoryNodes.$inferSelect;

export type FastReflection = {
  id: string;
  hash: string;
  resource: string;
  conclusion: string;
  derived: string[];
  confidence: number;
  createdAt: Date | null;
};

export type FastGetReflectionsOptions = {
  limit?: number;
  resource?: string;
};

/**
 * Performance-critical reflection retrieval.
 * Pulls the latest insight nodes from the knowledge graph, scoped to the
 * caller's resource when available, and falls back to global reflections
 * when no scoped entries exist.
 */
export async function fast_getReflections(
  userId: string,
  options: FastGetReflectionsOptions = {}
): Promise<FastReflection[]> {
  const limit = normalizeLimit(options.limit);
  const resourceCandidates = resolveResourceCandidates(
    userId,
    options.resource
  );

  const scopedRows = await fetchReflectionRows(resourceCandidates, limit);

  const shouldFallback =
    scopedRows.length === 0 &&
    resourceCandidates.length > 0 &&
    !hasExplicitResource(options.resource);

  if (shouldFallback) {
    const globalRows = await fetchReflectionRows([], limit);
    return globalRows.map(formatReflection);
  }

  return scopedRows.map(formatReflection);
}

function hasExplicitResource(resource?: string): boolean {
  return typeof resource === "string" && resource.trim().length > 0;
}

function normalizeLimit(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  const normalized = Math.floor(value);
  if (normalized <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, normalized);
}

function resolveResourceCandidates(
  userId: string,
  explicitResource?: string
): string[] {
  if (explicitResource && explicitResource.trim().length > 0) {
    return [explicitResource.trim()];
  }

  const trimmed = userId.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const candidates = new Set<string>([trimmed]);
  if (!trimmed.startsWith("runtime:")) {
    candidates.add(`runtime:${trimmed}`);
  }

  return Array.from(candidates);
}

function fetchReflectionRows(
  resources: string[],
  limit: number
): Promise<MemoryNodeRow[]> {
  const whereClause = buildWhereClause(resources);

  return db
    .select()
    .from(memoryNodes)
    .where(whereClause)
    .orderBy(desc(memoryNodes.created))
    .limit(limit);
}

function buildWhereClause(resources: string[]) {
  const basePredicate = eq(memoryNodes.kind, REFLECTION_KIND);
  if (resources.length === 0) {
    return basePredicate;
  }

  const uniqueResources = Array.from(new Set(resources.filter(Boolean)));
  if (uniqueResources.length === 0) {
    return basePredicate;
  }

  if (uniqueResources.length === 1) {
    const first = uniqueResources[0];
    if (first) {
      return and(basePredicate, eq(memoryNodes.resource, first));
    }
  }

  return and(
    basePredicate,
    inArray(memoryNodes.resource, uniqueResources as [string, ...string[]])
  );
}

function formatReflection(row: MemoryNodeRow): FastReflection {
  const props = readProperties(row.properties);
  return {
    id: row.id,
    hash: row.hash,
    resource: row.resource,
    conclusion: row.label,
    derived: readDerived(props),
    confidence: readConfidence(props),
    createdAt: toDate(row.created),
  };
}

function readProperties(
  value: MemoryNodeRow["properties"]
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function readDerived(props: Record<string, unknown> | null): string[] {
  if (!props) {
    return [];
  }
  const raw = props.derived;
  if (!Array.isArray(raw)) {
    return [];
  }
  const derived: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string" && entry.length > 0) {
      derived.push(entry);
    }
  }
  return derived;
}

function readConfidence(props: Record<string, unknown> | null): number {
  if (!props) {
    return 0.75;
  }
  const raw = props.confidence;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return clampConfidence(raw);
  }
  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) {
      return clampConfidence(parsed);
    }
  }
  return 0.75;
}

function clampConfidence(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function toDate(value: MemoryNodeRow["created"]): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  return null;
}
