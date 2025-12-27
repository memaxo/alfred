import type { KnowledgeEntry } from "./extractor.js";
import {
  type Hypergraph,
  type Knowledge,
  type NodeId,
  nodeFromHash,
  type Timestamp,
  timestamp,
  toConfidence,
} from "./hypergraph.js";
import { measureAsync, measureSync } from "./metrics.js";

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

export type Embedder = {
  embed: (text: string) => Promise<Float32Array>;
  embedMany?: (texts: string[]) => Promise<Float32Array[]>;
};

export type AutoPersistOptions = {
  intervalMs?: number;
  batchSize?: number;
  computeEmbeddings?: boolean;
  embedBatchSize?: number;
  onError?: (err: unknown) => void;
  embedder?: Embedder;
  isEmbeddable?: (k: Knowledge) => boolean;
};

export type AutoPersistHandle = {
  stop(): void;
  flush(): Promise<void>;
};

const PERSIST_BUDGET_MS = 25;
const LOAD_BUDGET_MS = 30;
const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_EMBED_BATCH = 50;

export function extractEntries(
  graph: Hypergraph,
  opts?: { onlyDirty?: boolean }
): KnowledgeEntry[] {
  return measureSync("knowledge.persist.extract", 5, () => {
    const ids = opts?.onlyDirty ? graph.getDirty() : Array.from(graph.ids());
    const entries: KnowledgeEntry[] = [];
    for (const id of ids) {
      const knowledge = graph.get(id);
      if (!knowledge) {
        continue;
      }
      entries.push({ hash: String(id), data: knowledge });
    }
    return entries;
  });
}

export async function persistHypergraph(
  graph: Hypergraph,
  resource: string,
  persist: PersistFn
): Promise<void> {
  await measureAsync("knowledge.persist.flush", PERSIST_BUDGET_MS, async () => {
    const entries = extractEntries(graph, { onlyDirty: true });
    if (entries.length === 0) {
      return;
    }
    await persist(resource, entries);
    const ids = entries.map((entry) => nodeFromHash(entry.hash));
    graph.markClean(ids);
  });
}

export async function loadHypergraph(
  resource: string,
  graph: Hypergraph,
  loader: HypergraphLoader
): Promise<void> {
  await measureAsync("knowledge.persist.load", LOAD_BUDGET_MS, async () => {
    const [nodes, relations] = await Promise.all([
      loader.loadNodes(resource),
      loader.loadRelations(resource),
    ]);

    for (const node of nodes) {
      const knowledge = deserializeNode(node);
      if (knowledge) {
        graph.hydrate(node.hash, knowledge);
      }
    }

    for (const relation of relations) {
      const knowledge = deserializeRelation(relation);
      if (knowledge) {
        graph.hydrate(relation.hash, knowledge);
      }
    }

    graph.markClean();
  });
}

export function startAutoPersist(
  graph: Hypergraph,
  resource: string,
  persist: PersistFn,
  options: AutoPersistOptions = {}
): AutoPersistHandle {
  const intervalMs = Math.max(250, options.intervalMs ?? DEFAULT_INTERVAL_MS);
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE);
  const embedBatchSize = Math.max(
    1,
    options.embedBatchSize ?? DEFAULT_EMBED_BATCH
  );
  const computeEmbeddings = options.computeEmbeddings ?? true;
  const embedder = options.embedder;
  const isEmbeddable =
    options.isEmbeddable ?? ((knowledge: Knowledge) => knowledge._ === "fact");
  const onError = options.onError;
  const processedEmbeddings = new Set<NodeId>();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flushChunk = async (ids: NodeId[]): Promise<void> => {
    if (ids.length === 0) {
      return;
    }
    const entries: KnowledgeEntry[] = [];
    const processedIds: NodeId[] = [];
    for (const id of ids) {
      const knowledge = graph.get(id);
      if (knowledge) {
        entries.push({ hash: String(id), data: knowledge });
      }
      processedIds.push(id);
    }
    if (entries.length > 0) {
      await persist(resource, entries);
    }
    graph.markClean(processedIds);
  };

  const flushDirty = async (all = false): Promise<void> => {
    if (all) {
      while (true) {
        const dirty = graph.getDirty();
        if (dirty.length === 0) {
          break;
        }
        await flushChunk(dirty.slice(0, batchSize));
      }
      return;
    }
    const dirty = graph.getDirty();
    if (dirty.length === 0) {
      return;
    }
    await flushChunk(dirty.slice(0, batchSize));
  };

  const embedMissing = async (): Promise<void> => {
    if (!(computeEmbeddings && embedder)) {
      return;
    }
    const candidates: Array<{ id: NodeId; text: string }> = [];
    for (const [id, knowledge] of graph.entries()) {
      if (candidates.length >= embedBatchSize) {
        break;
      }
      if (!isEmbeddable(knowledge)) {
        continue;
      }
      if (graph.getEmbedding(id) || processedEmbeddings.has(id)) {
        continue;
      }
      const text = embeddingText(knowledge);
      if (!text) {
        continue;
      }
      candidates.push({ id, text });
    }
    if (candidates.length === 0) {
      return;
    }
    const texts = candidates.map((entry) => entry.text);
    let vectors: Float32Array[] = [];
    if (embedder.embedMany) {
      vectors = await embedder.embedMany(texts);
    } else {
      for (const text of texts) {
        vectors.push(await embedder.embed(text));
      }
    }
    for (let i = 0; i < candidates.length; i++) {
      const vector = vectors[i];
      if (!vector) {
        continue;
      }
      graph.setEmbedding(candidates[i]?.id, vector);
      processedEmbeddings.add(candidates[i]?.id);
    }
  };

  const scheduleNext = () => {
    if (stopped) {
      return;
    }
    timer = setTimeout(run, intervalMs);
  };

  const run = async () => {
    if (stopped) {
      return;
    }
    try {
      await flushDirty();
      await embedMissing();
    } catch (err) {
      onError?.(err);
    } finally {
      scheduleNext();
    }
  };

  run();

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    async flush() {
      await flushDirty(true);
    },
  };
}

function deserializeNode(record: NodeRecord): Knowledge | null {
  const props = record.properties ?? {};
  switch (record.kind) {
    case "fact": {
      return {
        _: "fact",
        content: record.label,
        confidence: toConfidence(clamp01(readNumber(props, "confidence", 0.8))),
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
    weight:
      typeof record.weight === "number" && Number.isFinite(record.weight)
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
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function embeddingText(knowledge: Knowledge): string | null {
  switch (knowledge._) {
    case "fact":
      return knowledge.content;
    case "insight":
      return knowledge.conclusion;
    case "pattern":
      return knowledge.rule;
    case "relation":
      return `${knowledge.kind}:${knowledge.from}->${knowledge.to}`;
    default:
      return null;
  }
}
