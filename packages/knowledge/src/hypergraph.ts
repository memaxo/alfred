/**
 * Knowledge Hypergraph Implementation
 * Zero-allocation design with content-addressed nodes
 */

import { IntervalTree } from "./indices/interval-tree.js";

// Types
export type NodeId = string & { readonly _: unique symbol };
export type Confidence = number & {
  readonly _: unique symbol;
  readonly min: 0;
  readonly max: 1;
};
export type Timestamp = number & { readonly _: unique symbol };

export type Knowledge =
  | {
      _: "fact";
      content: string;
      confidence: Confidence;
      source: string;
      ts: Timestamp;
    }
  | { _: "relation"; from: NodeId; to: NodeId; kind: string; weight: number }
  | {
      _: "insight";
      derived: NodeId[];
      conclusion: string;
      confidence: Confidence;
    }
  | { _: "pattern"; examples: NodeId[]; rule: string; accuracy: number };

// Brand constructors with validation
const nodeId = (s: string): NodeId => s as NodeId;
export const toConfidence = (n: number): Confidence => {
  if (n < 0 || n > 1) throw new Error("Invalid confidence");
  return n as Confidence;
};
export const timestamp = (n: number): Timestamp => n as Timestamp;

export const nodeFromHash = (hash: string): NodeId => nodeId(hash);

export const knowledgeHash = (k: Knowledge): string => {
  let s = `${k._}:`;
  switch (k._) {
    case "fact":
      s += k.content + k.source + k.confidence;
      break;
    case "relation":
      s += k.from + k.to + k.kind + k.weight;
      break;
    case "insight":
      s += k.derived.join(",") + k.conclusion;
      break;
    case "pattern":
      s += k.examples.join(",") + k.rule;
      break;
  }
  return hashString(s);
};

const hashString = (input: string): string => {
  let h = 2_166_136_261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 16_777_619) >>> 0;
  }
  return h.toString(36);
};

// HAMT (Hash Array Mapped Trie) for O(1) content addressing
class HAMT<V> {
  private readonly root = new Map<number, Map<string, V>>();

  set(key: string, value: V): void {
    const hash = this.hash(key);
    const bucket = hash & 0xff;
    if (!this.root.has(bucket)) {
      this.root.set(bucket, new Map());
    }
    this.root.get(bucket)!.set(key, value);
  }

  get(key: string): V | undefined {
    const hash = this.hash(key);
    const bucket = hash & 0xff;
    return this.root.get(bucket)?.get(key);
  }

  *entries(): IterableIterator<[string, V]> {
    for (const bucket of this.root.values()) {
      for (const entry of bucket.entries()) {
        yield entry;
      }
    }
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h;
  }
}

// RTree for spatial/semantic similarity (simplified 1D for embeddings)
class RTree {
  // TODO: Implement proper R-tree with MBR (Minimum Bounding Rectangles)
  // Current implementation is simplified to 1D, need multi-dimensional support
  // Should handle 1536-dim vectors from OpenAI embeddings
  private readonly nodes: Array<[number, number, NodeId]> = [];

  insert(embedding: number, id: NodeId): void {
    // TODO: Accept full embedding vector, not single number
    // Should compute MBR and use R-tree splitting algorithm
    this.nodes.push([embedding, embedding, id]);
  }

  range(min: number, max: number): NodeId[] {
    const result: NodeId[] = [];
    for (const [low, high, id] of this.nodes) {
      if (low <= max && high >= min) {
        result.push(id);
      }
    }
    return result;
  }
}

// BTree for ordered traversal
class BTree {
  private readonly order = 32;
  private readonly keys: string[] = [];
  private readonly values: NodeId[] = [];

  insert(key: string, id: NodeId): void {
    // TODO: Implement proper B-tree with node splitting
    // Current implementation uses array splice (O(n))
    // Should maintain tree structure with internal/leaf nodes
    let i = 0;
    while (i < this.keys.length && this.keys[i] < key) i++;
    this.keys.splice(i, 0, key);
    this.values.splice(i, 0, id);
  }

  range(start: string, end: string): NodeId[] {
    const result: NodeId[] = [];
    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i] >= start && this.keys[i] <= end) {
        result.push(this.values[i]);
      }
      if (this.keys[i] > end) break;
    }
    return result;
  }
}

// Main Hypergraph
export class Hypergraph {
  private readonly nodes = new HAMT<Knowledge>();
  private readonly temporal = new IntervalTree();
  private readonly spatial = new RTree();
  private readonly ordered = new BTree();
  private readonly edges = new Map<NodeId, Set<NodeId>>();
  private readonly inbound = new Map<NodeId, Set<NodeId>>();
  private readonly edgesByKind = new Map<string, Map<NodeId, Set<NodeId>>>();
  private readonly inboundByKind = new Map<string, Map<NodeId, Set<NodeId>>>();
  private readonly dirty = new Set<NodeId>();
  private readonly embeddings = new Map<NodeId, Float32Array>();
  private nodeCount = 0;
  private modCount = 0;

  add(k: Knowledge): NodeId {
    const id = this.contentAddress(k);
    const nodeRef = nodeId(id);
    const existing = this.nodes.get(id);
    this.nodes.set(id, k);

    const isNew = !existing;

    if (isNew) {
      // Index by type
      switch (k._) {
        case "fact":
          this.temporal.insert({ start: k.ts, end: k.ts, id: nodeRef });
          this.ordered.insert(k.content, nodeRef);
          // TODO: Add fact embeddings to spatial index
          // Should call embed() function and index in RTree
          break;
        case "relation":
          if (!this.edges.has(k.from)) this.edges.set(k.from, new Set());
          this.edges.get(k.from)!.add(k.to);

          if (!this.inbound.has(k.to)) this.inbound.set(k.to, new Set());
          this.inbound.get(k.to)!.add(k.from);

          const outboundKind = this.ensureKindBucket(
            this.edgesByKind,
            k.kind,
            k.from
          );
          outboundKind.add(k.to);

          const inboundKind = this.ensureKindBucket(
            this.inboundByKind,
            k.kind,
            k.to
          );
          inboundKind.add(k.from);
          break;
        case "insight":
          // TODO: Index insights by confidence level
          // TODO: Add semantic embedding to spatial index
          break;
        case "pattern":
          // TODO: Index patterns by accuracy threshold
          // TODO: Maintain pattern match cache
          break;
      }
    }

    this.dirty.add(nodeRef);
    if (isNew) {
      this.nodeCount++;
    }
    this.modCount++;

    return nodeRef;
  }

  get(id: NodeId): Knowledge | undefined {
    return this.nodes.get(id);
  }

  // O(1) relation traversal
  neighbors(id: NodeId): NodeId[] {
    return Array.from(this.edges.get(id) || []);
  }

  // Temporal queries
  between(start: Timestamp, end: Timestamp): NodeId[] {
    let rangeStart = start;
    let rangeEnd = end;
    if (rangeEnd < rangeStart) {
      [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
    }
    return this.temporal.queryRange(rangeStart, rangeEnd);
  }

  predecessors(id: NodeId): NodeId[] {
    return Array.from(this.inbound.get(id) ?? []);
  }

  neighborsByKind(id: NodeId, kind?: string): NodeId[] {
    if (!kind) {
      return this.neighbors(id);
    }
    const bucket = this.edgesByKind.get(kind)?.get(id);
    return bucket ? Array.from(bucket) : [];
  }

  predecessorsByKind(id: NodeId, kind?: string): NodeId[] {
    if (!kind) {
      return this.predecessors(id);
    }
    const bucket = this.inboundByKind.get(kind)?.get(id);
    return bucket ? Array.from(bucket) : [];
  }

  *entries(): IterableIterator<[NodeId, Knowledge]> {
    for (const [key, value] of this.nodes.entries()) {
      yield [nodeId(key), value];
    }
  }

  *ids(): IterableIterator<NodeId> {
    for (const [key] of this.nodes.entries()) {
      yield nodeId(key);
    }
  }

  size(): number {
    return this.nodeCount;
  }

  version(): number {
    return this.modCount;
  }

  setEmbedding(id: NodeId, vector: Float32Array): void {
    this.embeddings.set(id, vector);
    this.dirty.add(id);
    this.modCount++;
  }

  getEmbedding(id: NodeId): Float32Array | undefined {
    return this.embeddings.get(id);
  }

  getDirty(): NodeId[] {
    return Array.from(this.dirty);
  }

  markClean(ids?: NodeId[]): void {
    if (ids && ids.length > 0) {
      for (const id of ids) {
        this.dirty.delete(id);
      }
    } else {
      this.dirty.clear();
    }
  }

  // Content queries
  search(pattern: string): NodeId[] {
    // For MVP, use BTree range query
    return this.ordered.range(pattern, pattern + "\xFF");
  }

  private contentAddress(k: Knowledge): string {
    return knowledgeHash(k);
  }

  private ensureKindBucket(
    map: Map<string, Map<NodeId, Set<NodeId>>>,
    kind: string,
    node: NodeId
  ): Set<NodeId> {
    let kindMap = map.get(kind);
    if (!kindMap) {
      kindMap = new Map();
      map.set(kind, kindMap);
    }
    let bucket = kindMap.get(node);
    if (!bucket) {
      bucket = new Set();
      kindMap.set(node, bucket);
    }
    return bucket;
  }
}

// Factory functions for clean API
export const empty = (): Hypergraph => new Hypergraph();

export const fact = (
  content: string,
  conf: number,
  source: string
): Knowledge => ({
  _: "fact",
  content,
  confidence: toConfidence(conf),
  source,
  ts: timestamp(Date.now()),
});

export const relation = (
  from: NodeId,
  to: NodeId,
  kind: string,
  weight = 1.0
): Knowledge => ({
  _: "relation",
  from,
  to,
  kind,
  weight,
});

export const insight = (
  derived: NodeId[],
  conclusion: string,
  conf: number
): Knowledge => ({
  _: "insight",
  derived,
  conclusion,
  confidence: toConfidence(conf),
});

export const pattern = (
  examples: NodeId[],
  rule: string,
  accuracy: number
): Knowledge => ({
  _: "pattern",
  examples,
  rule,
  accuracy,
});
