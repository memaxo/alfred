/**
 * Dynamic Similarity-Aware BFS (DSA-BFS)
 *
 * A graph traversal algorithm that prioritizes nodes by semantic similarity
 * rather than simple breadth-first traversal. Uses a priority queue to
 * expand nodes in order of relevance to the query.
 *
 * Reference: alfred-memory-review.md - "DSA-BFS improves retrieval quality"
 *
 * Key differences from standard BFS:
 * 1. Uses priority queue instead of FIFO queue
 * 2. Node priority = similarity × depth_factor
 * 3. Expands most relevant nodes first
 * 4. Can terminate early when confidence threshold met
 */

import type { NodeRow } from "./types";

import { cosineSimilarity } from "./scoring";

/**
 * Priority queue node for DSA-BFS traversal
 */
interface TraversalNode {
  node: NodeRow;
  priority: number;
  depth: number;
  path: string[];
  similarity: number;
}

/**
 * DSA-BFS configuration options
 */
export interface DsaBfsOptions {
  /** Maximum traversal depth (default: 5) */
  maxDepth?: number;
  /** Maximum node expansions before terminating (default: 100) */
  maxExpansions?: number;
  /** Weight for similarity in priority calculation (default: 0.7) */
  similarityWeight?: number;
  /** Weight for depth in priority calculation (default: 0.3) */
  depthWeight?: number;
  /** Early termination threshold - stop if similarity exceeds (default: 0.9) */
  earlyTerminationThreshold?: number;
}

/**
 * DSA-BFS result
 */
export interface DsaBfsResult {
  node: NodeRow;
  path: string[];
  depth: number;
  similarity: number;
  expansions: number;
}

/**
 * Simple priority queue implementation using a binary heap
 * Higher priority = dequeued first
 */
class PriorityQueue<T extends { priority: number }> {
  private readonly heap: T[] = [];

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  enqueue(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) {
      return;
    }

    const max = this.heap[0];
    const end = this.heap.pop();

    if (this.heap.length > 0 && end) {
      this.heap[0] = end;
      this.bubbleDown(0);
    }

    return max;
  }

  private bubbleUp(index: number): void {
    const item = this.heap[index];
    if (!item) {
      return;
    }

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (!parent || item.priority <= parent.priority) {
        break;
      }
      this.heap[index] = parent;
      index = parentIndex;
    }

    this.heap[index] = item;
  }

  private bubbleDown(index: number): void {
    const { length } = this.heap;
    const item = this.heap[index];
    if (!item) {
      return;
    }

    while (true) {
      const leftIndex = 2 * index + 1;
      const rightIndex = 2 * index + 2;
      let swapIndex = index;

      const left = leftIndex < length ? this.heap[leftIndex] : undefined;
      const right = rightIndex < length ? this.heap[rightIndex] : undefined;
      const current = this.heap[swapIndex];

      if (left && current && left.priority > current.priority) {
        swapIndex = leftIndex;
      }

      const swapItem = this.heap[swapIndex];
      if (right && swapItem && right.priority > swapItem.priority) {
        swapIndex = rightIndex;
      }

      if (swapIndex === index) {
        break;
      }

      const toSwap = this.heap[swapIndex];
      if (toSwap) {
        this.heap[index] = toSwap;
        this.heap[swapIndex] = item;
        index = swapIndex;
      } else {
        break;
      }
    }
  }
}

/**
 * Normalize embedding from various storage formats
 */
function normalizeEmbedding(value: unknown): number[] | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const nums = value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry));
    return nums.length > 0 ? nums : null;
  }

  if (value instanceof Uint8Array) {
    if (value.byteLength % 4 !== 0) {
      return null;
    }
    const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
    const result: number[] = [];
    for (let offset = 0; offset < view.byteLength; offset += 4) {
      result.push(view.getFloat32(offset, true));
    }
    return result.length > 0 ? result : null;
  }

  return null;
}

/**
 * Calculate traversal priority for a node.
 *
 * Priority formula: similarity × similarityWeight + (1 - depth/maxDepth) × depthWeight
 *
 * This prioritizes:
 * 1. Nodes with high semantic similarity to query
 * 2. Nodes closer to the start (shallower depth)
 */
export function computeTraversalPriority(
  similarity: number,
  depth: number,
  maxDepth: number,
  options: DsaBfsOptions = {}
): number {
  const similarityWeight = options.similarityWeight ?? 0.7;
  const depthWeight = options.depthWeight ?? 0.3;

  // Normalize depth to [0, 1] where 0 is deepest, 1 is shallowest
  const depthFactor = 1 - depth / maxDepth;

  // Combine similarity and depth factors
  return similarity * similarityWeight + depthFactor * depthWeight;
}

/**
 * Perform Dynamic Similarity-Aware BFS traversal.
 *
 * Unlike standard BFS which explores all nodes at depth d before depth d+1,
 * DSA-BFS uses a priority queue to explore the most promising nodes first,
 * where "promising" is determined by semantic similarity to the query.
 *
 * @param startNode - Node to start traversal from
 * @param queryEmbedding - Query embedding for similarity computation
 * @param getNeighbors - Function to get neighboring nodes
 * @param targetPredicate - Optional predicate to identify target nodes
 * @param options - Traversal options
 * @returns Best matching node and path, or null if none found
 */
export async function dsaBfs(
  startNode: NodeRow,
  queryEmbedding: number[] | undefined,
  getNeighbors: (nodeId: string) => Promise<NodeRow[]>,
  targetPredicate?: (node: NodeRow) => boolean,
  options: DsaBfsOptions = {}
): Promise<DsaBfsResult | null> {
  const maxDepth = options.maxDepth ?? 5;
  const maxExpansions = options.maxExpansions ?? 100;
  const earlyTerminationThreshold = options.earlyTerminationThreshold ?? 0.9;

  // Priority queue for traversal
  const queue = new PriorityQueue<TraversalNode>();

  // Track visited nodes to avoid cycles
  const visited = new Set<string>();

  // Track best result so far
  let bestResult: DsaBfsResult | null = null;
  let expansions = 0;

  // Calculate initial similarity
  const startEmbedding = normalizeEmbedding(startNode.embedding);
  const startSimilarity =
    startEmbedding && queryEmbedding
      ? cosineSimilarity(startEmbedding, queryEmbedding)
      : 0.5;

  // Initialize with start node
  queue.enqueue({
    node: startNode,
    priority: computeTraversalPriority(startSimilarity, 0, maxDepth, options),
    depth: 0,
    path: [startNode.id],
    similarity: startSimilarity,
  });

  visited.add(startNode.id);

  // Check if start node matches target
  if (targetPredicate?.(startNode)) {
    bestResult = {
      node: startNode,
      path: [startNode.id],
      depth: 0,
      similarity: startSimilarity,
      expansions: 0,
    };

    // Early termination if similarity is high enough
    if (startSimilarity >= earlyTerminationThreshold) {
      return bestResult;
    }
  }

  // Main traversal loop
  while (!queue.isEmpty() && expansions < maxExpansions) {
    const current = queue.dequeue();
    if (!current) {
      break;
    }

    expansions++;

    // Skip if we've exceeded max depth
    if (current.depth >= maxDepth) {
      continue;
    }

    // Get neighbors
    const neighbors = await getNeighbors(current.node.id);

    for (const neighbor of neighbors) {
      // Skip visited nodes (cycle detection)
      if (visited.has(neighbor.id)) {
        continue;
      }

      visited.add(neighbor.id);

      // Calculate similarity for this neighbor
      const neighborEmbedding = normalizeEmbedding(neighbor.embedding);
      const similarity =
        neighborEmbedding && queryEmbedding
          ? cosineSimilarity(neighborEmbedding, queryEmbedding)
          : 0.3; // Default lower similarity for nodes without embeddings

      const newDepth = current.depth + 1;
      const newPath = [...current.path, neighbor.id];

      // Check if this is a target node
      const isTarget = targetPredicate?.(neighbor) ?? false;

      if (isTarget && (!bestResult || similarity > bestResult.similarity)) {
        bestResult = {
          node: neighbor,
          path: newPath,
          depth: newDepth,
          similarity,
          expansions,
        };

        // Early termination if similarity is high enough
        if (similarity >= earlyTerminationThreshold) {
          return bestResult;
        }
      }

      // Add to queue for further exploration
      if (newDepth < maxDepth) {
        queue.enqueue({
          node: neighbor,
          priority: computeTraversalPriority(
            similarity,
            newDepth,
            maxDepth,
            options
          ),
          depth: newDepth,
          path: newPath,
          similarity,
        });
      }
    }
  }

  return bestResult;
}

/**
 * Synchronous version for in-memory graph traversal.
 * Used when graph is already loaded into memory.
 */
export function dsaBfsSync(
  startNode: NodeRow,
  queryEmbedding: number[] | undefined,
  adjacency: Map<string, NodeRow[]>,
  targetPredicate?: (node: NodeRow) => boolean,
  options: DsaBfsOptions = {}
): DsaBfsResult | null {
  const maxDepth = options.maxDepth ?? 5;
  const maxExpansions = options.maxExpansions ?? 100;
  const earlyTerminationThreshold = options.earlyTerminationThreshold ?? 0.9;

  const queue = new PriorityQueue<TraversalNode>();
  const visited = new Set<string>();
  let bestResult: DsaBfsResult | null = null;
  let expansions = 0;

  const startEmbedding = normalizeEmbedding(startNode.embedding);
  const startSimilarity =
    startEmbedding && queryEmbedding
      ? cosineSimilarity(startEmbedding, queryEmbedding)
      : 0.5;

  queue.enqueue({
    node: startNode,
    priority: computeTraversalPriority(startSimilarity, 0, maxDepth, options),
    depth: 0,
    path: [startNode.id],
    similarity: startSimilarity,
  });

  visited.add(startNode.id);

  if (targetPredicate?.(startNode)) {
    bestResult = {
      node: startNode,
      path: [startNode.id],
      depth: 0,
      similarity: startSimilarity,
      expansions: 0,
    };

    if (startSimilarity >= earlyTerminationThreshold) {
      return bestResult;
    }
  }

  while (!queue.isEmpty() && expansions < maxExpansions) {
    const current = queue.dequeue();
    if (!current || current.depth >= maxDepth) {
      continue;
    }

    expansions++;

    const neighbors = adjacency.get(current.node.id) ?? [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.id)) {
        continue;
      }

      visited.add(neighbor.id);

      const neighborEmbedding = normalizeEmbedding(neighbor.embedding);
      const similarity =
        neighborEmbedding && queryEmbedding
          ? cosineSimilarity(neighborEmbedding, queryEmbedding)
          : 0.3;

      const newDepth = current.depth + 1;
      const newPath = [...current.path, neighbor.id];

      const isTarget = targetPredicate?.(neighbor) ?? false;

      if (isTarget && (!bestResult || similarity > bestResult.similarity)) {
        bestResult = {
          node: neighbor,
          path: newPath,
          depth: newDepth,
          similarity,
          expansions,
        };

        if (similarity >= earlyTerminationThreshold) {
          return bestResult;
        }
      }

      if (newDepth < maxDepth) {
        queue.enqueue({
          node: neighbor,
          priority: computeTraversalPriority(
            similarity,
            newDepth,
            maxDepth,
            options
          ),
          depth: newDepth,
          path: newPath,
          similarity,
        });
      }
    }
  }

  return bestResult;
}

/**
 * Find multiple results using DSA-BFS.
 * Continues traversal until k results found or maxExpansions reached.
 */
export async function dsaBfsTopK(
  startNode: NodeRow,
  queryEmbedding: number[] | undefined,
  getNeighbors: (nodeId: string) => Promise<NodeRow[]>,
  targetPredicate: (node: NodeRow) => boolean,
  k: number,
  options: DsaBfsOptions = {}
): Promise<DsaBfsResult[]> {
  const maxDepth = options.maxDepth ?? 5;
  const maxExpansions = options.maxExpansions ?? 200;

  const queue = new PriorityQueue<TraversalNode>();
  const visited = new Set<string>();
  const results: DsaBfsResult[] = [];
  let expansions = 0;

  const startEmbedding = normalizeEmbedding(startNode.embedding);
  const startSimilarity =
    startEmbedding && queryEmbedding
      ? cosineSimilarity(startEmbedding, queryEmbedding)
      : 0.5;

  queue.enqueue({
    node: startNode,
    priority: computeTraversalPriority(startSimilarity, 0, maxDepth, options),
    depth: 0,
    path: [startNode.id],
    similarity: startSimilarity,
  });

  visited.add(startNode.id);

  if (targetPredicate(startNode)) {
    results.push({
      node: startNode,
      path: [startNode.id],
      depth: 0,
      similarity: startSimilarity,
      expansions: 0,
    });

    if (results.length >= k) {
      return results;
    }
  }

  while (!queue.isEmpty() && expansions < maxExpansions && results.length < k) {
    const current = queue.dequeue();
    if (!current || current.depth >= maxDepth) {
      continue;
    }

    expansions++;

    const neighbors = await getNeighbors(current.node.id);

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.id)) {
        continue;
      }

      visited.add(neighbor.id);

      const neighborEmbedding = normalizeEmbedding(neighbor.embedding);
      const similarity =
        neighborEmbedding && queryEmbedding
          ? cosineSimilarity(neighborEmbedding, queryEmbedding)
          : 0.3;

      const newDepth = current.depth + 1;
      const newPath = [...current.path, neighbor.id];

      if (targetPredicate(neighbor)) {
        results.push({
          node: neighbor,
          path: newPath,
          depth: newDepth,
          similarity,
          expansions,
        });

        if (results.length >= k) {
          return results.sort((a, b) => b.similarity - a.similarity);
        }
      }

      if (newDepth < maxDepth) {
        queue.enqueue({
          node: neighbor,
          priority: computeTraversalPriority(
            similarity,
            newDepth,
            maxDepth,
            options
          ),
          depth: newDepth,
          path: newPath,
          similarity,
        });
      }
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}
