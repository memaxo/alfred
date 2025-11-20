import type { KnowledgeEntry } from "./extractor.js";
import {
  knowledgeHash,
  nodeFromHash,
  timestamp,
  toConfidence,
  type Hypergraph,
  type Knowledge,
  type NodeId,
  type Timestamp,
} from "./hypergraph.js";

export type PersistFn = (
  resource: string,
  entries: KnowledgeEntry[]
) => Promise<void>;

export type NodeRecord = {
  hash: string;
  kind: Knowledge["_"];
  label: string;
  properties?: Record<string, unknown> | null;
};

export type RelationRecord = {
  hash: string;
  fromHash: string;
  toHash: string;
  kind: string;
  weight?: number | null;
};

export type HypergraphLoader = {
  loadNodes(resource: string): Promise<NodeRecord[]>;
  loadRelations(resource: string): Promise<RelationRecord[]>;
};

export function extractEntries(
  graph: Hypergraph,
  opts?: { onlyDirty?: boolean }
): KnowledgeEntry[] {
  const ids = opts?.onlyDirty ? graph.getDirty() : Array.from(graph.ids());
  const entries: KnowledgeEntry[] = [];
  for (const id of ids) {
    const knowledge = graph.get(id);
    if (!knowledge) {
      continue;
    }
    entries.push({ hash: knowledgeHash(knowledge), data: knowledge });
  }
  return entries;
}

export async function persistHypergraph(
  graph: Hypergraph,
  resource: string,
  persist: PersistFn
): Promise<void> {
  const entries = extractEntries(graph, { onlyDirty: true });
  if (entries.length === 0) {
    return;
  }
  await persist(resource, entries);
  const ids = entries.map((entry) => nodeFromHash(entry.hash));
  graph.markClean(ids);
}

export async function loadHypergraph(
  resource: string,
  graph: Hypergraph,
  loader: HypergraphLoader
): Promise<void> {
  const [nodes, relations] = await Promise.all([
    loader.loadNodes(resource),
    loader.loadRelations(resource),
  ]);

  for (const node of nodes) {
    const knowledge = deserializeNode(node);
    if (knowledge) {
      graph.add(knowledge);
    }
  }

  for (const relation of relations) {
    const knowledge = deserializeRelation(relation);
    if (knowledge) {
      graph.add(knowledge);
    }
  }

  graph.markClean();
}

function deserializeNode(record: NodeRecord): Knowledge | null {
  const props = record.properties ?? {};
  switch (record.kind) {
    case "fact": {
      return {
        _: "fact",
        content: record.label,
        confidence: toConfidence(
          clamp01(readNumber(props, "confidence", 0.8))
        ),
        source: readString(props, "source", "unknown"),
        ts: readTimestamp(props, "ts", Date.now()),
      };
    }
    case "insight": {
      const derived = readStringArray(props, "derived").map(nodeFromHash);
      return {
        _: "insight",
        derived,
        conclusion: record.label,
        confidence: toConfidence(
          clamp01(readNumber(props, "confidence", 0.75))
        ),
      };
    }
    case "pattern": {
      const examples = readStringArray(props, "examples").map(nodeFromHash);
      return {
        _: "pattern",
        examples,
        rule: record.label,
        accuracy: clamp01(readNumber(props, "accuracy", 0.5)),
      };
    }
    default:
      return null;
  }
}

function deserializeRelation(record: RelationRecord): Knowledge | null {
  if (!(record.fromHash && record.toHash)) {
    return null;
  }
  return {
    _: "relation",
    from: nodeFromHash(record.fromHash),
    to: nodeFromHash(record.toHash),
    kind: record.kind,
    weight: typeof record.weight === "number" && Number.isFinite(record.weight)
      ? record.weight
      : 1,
  };
}

function readNumber(
  props: Record<string, unknown>,
  key: string,
  fallback: number
): number {
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
}

function readString(
  props: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const value = props[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readStringArray(
  props: Record<string, unknown>,
  key: string
): string[] {
  const value = props[key];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : String(entry)))
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function readTimestamp(
  props: Record<string, unknown>,
  key: string,
  fallback: number
): Timestamp {
  const asNumber = readNumber(props, key, fallback);
  return timestamp(asNumber);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
