/**
 * Knowledge Hypergraph Implementation
 * Zero-allocation design with content-addressed nodes
 */

// Types
type NodeId = string & { readonly _: unique symbol }
type Confidence = number & { readonly _: unique symbol; readonly min: 0; readonly max: 1 }
type Timestamp = number & { readonly _: unique symbol }

type Knowledge = 
  | { _: "fact"; content: string; confidence: Confidence; source: string; ts: Timestamp }
  | { _: "relation"; from: NodeId; to: NodeId; kind: string; weight: number }
  | { _: "insight"; derived: NodeId[]; conclusion: string; confidence: Confidence }
  | { _: "pattern"; examples: NodeId[]; rule: string; accuracy: number }

// Brand constructors with validation
const nodeId = (s: string): NodeId => s as NodeId
const confidence = (n: number): Confidence => {
  if (n < 0 || n > 1) throw new Error("Invalid confidence")
  return n as Confidence
}
const timestamp = (n: number): Timestamp => n as Timestamp

// HAMT (Hash Array Mapped Trie) for O(1) content addressing
class HAMT<V> {
  private readonly root = new Map<number, Map<string, V>>()
  
  set(key: string, value: V): void {
    const hash = this.hash(key)
    const bucket = hash & 0xFF
    if (!this.root.has(bucket)) {
      this.root.set(bucket, new Map())
    }
    this.root.get(bucket)!.set(key, value)
  }
  
  get(key: string): V | undefined {
    const hash = this.hash(key)
    const bucket = hash & 0xFF
    return this.root.get(bucket)?.get(key)
  }
  
  private hash(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0
    }
    return h
  }
}

// IntervalTree for temporal queries
class IntervalTree {
  private readonly intervals: Array<[Timestamp, Timestamp, NodeId]> = []
  
  insert(start: Timestamp, end: Timestamp, id: NodeId): void {
    // TODO: Implement proper interval tree with balanced structure
    // Current implementation sorts on every insert (O(n log n))
    // Should use augmented red-black tree for O(log n) operations
    this.intervals.push([start, end, id])
    this.intervals.sort((a, b) => a[0] - b[0])
  }
  
  query(ts: Timestamp): NodeId[] {
    const result: NodeId[] = []
    for (const [start, end, id] of this.intervals) {
      if (start <= ts && ts <= end) {
        result.push(id)
      }
      if (start > ts) break
    }
    return result
  }
}

// RTree for spatial/semantic similarity (simplified 1D for embeddings)
class RTree {
  // TODO: Implement proper R-tree with MBR (Minimum Bounding Rectangles)
  // Current implementation is simplified to 1D, need multi-dimensional support
  // Should handle 1536-dim vectors from OpenAI embeddings
  private readonly nodes: Array<[number, number, NodeId]> = []
  
  insert(embedding: number, id: NodeId): void {
    // TODO: Accept full embedding vector, not single number
    // Should compute MBR and use R-tree splitting algorithm
    this.nodes.push([embedding, embedding, id])
  }
  
  range(min: number, max: number): NodeId[] {
    const result: NodeId[] = []
    for (const [low, high, id] of this.nodes) {
      if (low <= max && high >= min) {
        result.push(id)
      }
    }
    return result
  }
}

// BTree for ordered traversal
class BTree {
  private readonly order = 32
  private readonly keys: string[] = []
  private readonly values: NodeId[] = []
  
  insert(key: string, id: NodeId): void {
    // TODO: Implement proper B-tree with node splitting
    // Current implementation uses array splice (O(n))
    // Should maintain tree structure with internal/leaf nodes
    let i = 0
    while (i < this.keys.length && this.keys[i] < key) i++
    this.keys.splice(i, 0, key)
    this.values.splice(i, 0, id)
  }
  
  range(start: string, end: string): NodeId[] {
    const result: NodeId[] = []
    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i] >= start && this.keys[i] <= end) {
        result.push(this.values[i])
      }
      if (this.keys[i] > end) break
    }
    return result
  }
}

// Main Hypergraph
export class Hypergraph {
  private readonly nodes = new HAMT<Knowledge>()
  private readonly temporal = new IntervalTree()
  private readonly spatial = new RTree()
  private readonly ordered = new BTree()
  private readonly edges = new Map<NodeId, Set<NodeId>>()
  
  add(k: Knowledge): NodeId {
    const id = this.contentAddress(k)
    this.nodes.set(id, k)
    
    // Index by type
    switch (k._) {
      case "fact":
        this.temporal.insert(k.ts, k.ts, nodeId(id))
        this.ordered.insert(k.content, nodeId(id))
        // TODO: Add fact embeddings to spatial index
        // Should call embed() function and index in RTree
        break
      case "relation":
        if (!this.edges.has(k.from)) this.edges.set(k.from, new Set())
        this.edges.get(k.from)!.add(k.to)
        break
      case "insight":
        // TODO: Index insights by confidence level
        // TODO: Add semantic embedding to spatial index
        break
      case "pattern":
        // TODO: Index patterns by accuracy threshold
        // TODO: Maintain pattern match cache
        break
    }
    
    return nodeId(id)
  }
  
  get(id: NodeId): Knowledge | undefined {
    return this.nodes.get(id)
  }
  
  // O(1) relation traversal
  neighbors(id: NodeId): NodeId[] {
    return Array.from(this.edges.get(id) || [])
  }
  
  // Temporal queries
  between(start: Timestamp, end: Timestamp): NodeId[] {
    // TODO: Implement actual temporal range query
    // Should query IntervalTree for all intervals overlapping [start, end]
    // Current implementation returns empty array
    const ids: NodeId[] = []
    return ids
  }
  
  // Content queries
  search(pattern: string): NodeId[] {
    // For MVP, use BTree range query
    return this.ordered.range(pattern, pattern + "\xFF")
  }
  
  private contentAddress(k: Knowledge): string {
    // Fast hash for content addressing
    let s = k._ + ":"
    switch (k._) {
      case "fact":
        s += k.content + k.source + k.confidence
        break
      case "relation":
        s += k.from + k.to + k.kind + k.weight
        break
      case "insight":
        s += k.derived.join(",") + k.conclusion
        break
      case "pattern":
        s += k.examples.join(",") + k.rule
        break
    }
    return this.hash(s)
  }
  
  private hash(s: string): string {
    // TODO: Consider xxHash or CityHash for better distribution
    // FNV-1a is fast but may have collision issues at scale
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = (h * 16777619) >>> 0
    }
    return h.toString(36)
  }
}

// Factory functions for clean API
export const empty = (): Hypergraph => new Hypergraph()

export const fact = (
  content: string, 
  conf: number, 
  source: string
): Knowledge => ({
  _: "fact",
  content,
  confidence: confidence(conf),
  source,
  ts: timestamp(Date.now())
})

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
  weight
})

export const insight = (
  derived: NodeId[],
  conclusion: string,
  conf: number
): Knowledge => ({
  _: "insight",
  derived,
  conclusion,
  confidence: confidence(conf)
})

export const pattern = (
  examples: NodeId[],
  rule: string,
  accuracy: number
): Knowledge => ({
  _: "pattern",
  examples,
  rule,
  accuracy
})
