/**
 * Knowledge Hypergraph Implementation
 * Zero-allocation design with content-addressed nodes
 */

import { EMBEDDING_DIM } from "@alfred/embed";
import { createHash } from "node:crypto";
import { BTreeIndex } from "./indices/btree.js";
import { IntervalTree } from "./indices/interval-tree.js";
import { RTreeND } from "./indices/rtree.js";

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
const nodeId = (s: string): NodeId => {
  if (s.length === 0) {
    throw new Error("NodeId cannot be empty");
  }
  return s as NodeId;
};
export const toConfidence = (n: number): Confidence => {
  if (n < 0 || n > 1) {
    throw new Error("Invalid confidence");
  }
  return n as Confidence;
};
export const timestamp = (n: number): Timestamp => {
  if (!Number.isFinite(n)) {
    throw new Error("Timestamp must be a finite number");
  }
  if (n < 0) {
    throw new Error("Timestamp cannot be negative");
  }
  return n as Timestamp;
};

export const nodeFromHash = (hash: string): NodeId => nodeId(hash);

const knowledgeHashInput = (k: Knowledge): string => {
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
  return s;
};

export const knowledgeHash = (k: Knowledge): string => {
  return hashString(knowledgeHashInput(k));
};

const hashStringLegacy = (input: string): string => {
  let h = 2_166_136_261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 16_777_619) >>> 0;
  }
  return h.toString(36);
};

const hashString = (input: string): string =>
  createHash("sha256").update(input).digest("hex");

// HAMT (Hash Array Mapped Trie) for O(1) content addressing
class HAMT<V> {
  private readonly root = new Map<number, Map<string, V>>();

  set(key: string, value: V): void {
    const hash = this.hash(key);
    const bucket = hash & 0xff;
    if (!this.root.has(bucket)) {
      this.root.set(bucket, new Map());
    }
    this.root.get(bucket)?.set(key, value);
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

/**
 * Main Hypergraph
 *
 * @warning Memory growth: All internal Maps (edges, inbound, embeddings, etc.) grow
 * unbounded as nodes are added. For large graphs with >100k nodes, consider
 * implementing explicit cleanup via periodic persistence and reload, or using
 * the dirty tracking to prune unused entries.
 */
export class Hypergraph {
  private readonly nodes = new HAMT<Knowledge>();
  private readonly temporal = new IntervalTree();
  private readonly spatial = new RTreeND(1024);
  private readonly ordered = new BTreeIndex<string, NodeId>(64);
  /** @warning Grows unbounded. Consider cleanup for large graphs. */
  private readonly edges = new Map<NodeId, Set<NodeId>>();
  /** @warning Grows unbounded. Consider cleanup for large graphs. */
  private readonly inbound = new Map<NodeId, Set<NodeId>>();
  /** @warning Grows unbounded. Consider cleanup for large graphs. */
  private readonly edgesByKind = new Map<string, Map<NodeId, Set<NodeId>>>();
  /** @warning Grows unbounded. Consider cleanup for large graphs. */
  private readonly inboundByKind = new Map<string, Map<NodeId, Set<NodeId>>>();
  private readonly dirty = new Set<NodeId>();
  /** @warning Grows unbounded. Consider cleanup for large graphs. */
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
          break;
        case "relation": {
          if (!this.edges.has(k.from)) {
            this.edges.set(k.from, new Set());
          }
          this.edges.get(k.from)?.add(k.to);

          if (!this.inbound.has(k.to)) {
            this.inbound.set(k.to, new Set());
          }
          this.inbound.get(k.to)?.add(k.from);

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
        }
        case "insight":
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

  /**
   * Inserts a node using an explicit persisted hash.
   * Intended for loaders that must preserve stable IDs across hash upgrades.
   */
  hydrate(hash: string, k: Knowledge): NodeId {
    const id = nodeId(hash);
    const existing = this.nodes.get(hash);
    this.nodes.set(hash, k);

    const isNew = !existing;
    if (isNew) {
      switch (k._) {
        case "fact":
          this.temporal.insert({ start: k.ts, end: k.ts, id });
          this.ordered.insert(k.content, id);
          break;
        case "relation": {
          if (!this.edges.has(k.from)) {
            this.edges.set(k.from, new Set());
          }
          this.edges.get(k.from)?.add(k.to);

          if (!this.inbound.has(k.to)) {
            this.inbound.set(k.to, new Set());
          }
          this.inbound.get(k.to)?.add(k.from);

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
        }
        case "insight":
          break;
        case "pattern":
          break;
      }
    }

    if (isNew) {
      this.nodeCount++;
    }
    this.modCount++;

    return id;
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
    if (vector.length !== EMBEDDING_DIM) {
      throw new Error(`embedding_dim_mismatch_${EMBEDDING_DIM}`);
    }
    const stored =
      vector instanceof Float32Array ? vector : new Float32Array(vector);
    this.embeddings.set(id, stored);
    this.spatial.insertPoint(stored, id);
    this.modCount++;
  }

  getEmbedding(id: NodeId): Float32Array | undefined {
    return this.embeddings.get(id);
  }

  *embeddingEntries(): IterableIterator<[NodeId, Float32Array]> {
    for (const [key, value] of this.embeddings.entries()) {
      yield [key, value];
    }
  }

  embeddingCount(): number {
    return this.embeddings.size;
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
    return this.ordered.range(pattern, `${pattern}\xFF`);
  }

  private contentAddress(k: Knowledge): string {
    const input = knowledgeHashInput(k);
    const v2 = hashString(input);
    if (this.nodes.get(v2)) {
      return v2;
    }
    const v1 = hashStringLegacy(input);
    if (this.nodes.get(v1)) {
      return v1;
    }
    return v2;
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
  source: string,
  now?: number
): Knowledge => ({
  _: "fact",
  content,
  confidence: toConfidence(conf),
  source,
  ts: timestamp(now ?? Date.now()),
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
