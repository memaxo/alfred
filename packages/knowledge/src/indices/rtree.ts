import type { NodeId } from "../hypergraph.js";

export type HyperRect = { min: Float32Array; max: Float32Array };

type NodeEntry = {
  rect: HyperRect;
  id?: NodeId;
  child?: RTreeNode;
};

class RTreeNode {
  readonly entries: NodeEntry[] = [];
  constructor(readonly leaf: boolean, public parent: RTreeNode | null) {}
}

class MinHeap<T> {
  constructor(
    private readonly cmp: (a: T, b: T) => number,
    private readonly data: T[] = []
  ) {}

  push(value: T): void {
    this.data.push(value);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) {
      return undefined;
    }
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  get size(): number {
    return this.data.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.cmp(this.data[index]!, this.data[parent]!) >= 0) {
        break;
      }
      [this.data[index], this.data[parent]] = [
        this.data[parent]!,
        this.data[index]!,
      ];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.data.length;
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      if (
        left < length &&
        this.cmp(this.data[left]!, this.data[smallest]!) < 0
      ) {
        smallest = left;
      }
      if (
        right < length &&
        this.cmp(this.data[right]!, this.data[smallest]!) < 0
      ) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      [this.data[index], this.data[smallest]] = [
        this.data[smallest]!,
        this.data[index]!,
      ];
      index = smallest;
    }
  }
}

export class RTreeND {
  private root: RTreeNode;
  private readonly leafLookup = new Map<NodeId, RTreeNode>();
  private readonly entryLookup = new Map<NodeId, NodeEntry>();
  private readonly minEntries: number;

  constructor(
    readonly dim = 1024,
    readonly maxEntries = 64,
    minEntries = Math.floor(64 * 0.4)
  ) {
    if (this.dim <= 0) {
      throw new Error("rtree_dim_invalid");
    }
    if (this.maxEntries < 4) {
      throw new Error("rtree_max_entries_invalid");
    }
    const baseline = Number.isFinite(minEntries)
      ? minEntries
      : Math.floor(this.maxEntries * 0.4);
    const clamped = Math.max(2, Math.min(this.maxEntries - 1, baseline));
    this.minEntries = clamped;
    this.root = new RTreeNode(true, null);
  }

  insertPoint(vec: Float32Array, id: NodeId): void {
    if (vec.length !== this.dim) {
      throw new Error(`rtree_dim_mismatch_${this.dim}`);
    }
    const rect = { min: new Float32Array(vec), max: new Float32Array(vec) };
    this.insert(rect, id);
  }

  insert(rect: HyperRect, id: NodeId): void {
    this.ensureRect(rect);
    if (this.entryLookup.has(id)) {
      this.remove(id);
    }
    const normalized = this.normalizeRect(rect);
    const leaf = this.chooseLeaf(this.root, normalized);
    const entry: NodeEntry = { rect: normalized, id };
    leaf.entries.push(entry);
    this.leafLookup.set(id, leaf);
    this.entryLookup.set(id, entry);
    this.adjustTree(leaf);
  }

  search(rect: HyperRect): NodeId[] {
    this.ensureRect(rect);
    const normalized = this.normalizeRect(rect);
    const hits: NodeId[] = [];
    const stack: RTreeNode[] = [this.root];
    while (stack.length > 0) {
      const node = stack.pop()!;
      for (const entry of node.entries) {
        if (!this.intersects(entry.rect, normalized)) {
          continue;
        }
        if (node.leaf && entry.id) {
          hits.push(entry.id);
        } else if (entry.child) {
          stack.push(entry.child);
        }
      }
    }
    return hits;
  }

  nearestK(
    point: Float32Array,
    k: number
  ): Array<{ id: NodeId; dist: number }> {
    if (point.length !== this.dim) {
      throw new Error(`rtree_dim_mismatch_${this.dim}`);
    }
    if (k <= 0) {
      return [];
    }
    const heap = new MinHeap<{ node: RTreeNode; dist: number }>((a, b) => {
      if (a.dist === b.dist) {
        return 0;
      }
      return a.dist < b.dist ? -1 : 1;
    });
    heap.push({ node: this.root, dist: 0 });
    const results: Array<{ id: NodeId; dist: number }> = [];
    const worst = (): number =>
      results.length < k ? Number.POSITIVE_INFINITY : results[results.length - 1]!
        .dist;

    while (heap.size > 0) {
      const current = heap.pop()!;
      if (current.dist > worst()) {
        break;
      }
      const node = current.node;
      if (node.leaf) {
        for (const entry of node.entries) {
          if (!entry.id) continue;
          const dist = this.distancePointRect(point, entry.rect);
          this.insertResult(results, { id: entry.id, dist }, k);
        }
      } else {
        for (const entry of node.entries) {
          if (!entry.child) continue;
          heap.push({
            node: entry.child,
            dist: this.distancePointRect(point, entry.rect),
          });
        }
      }
    }
    return results;
  }

  remove(id: NodeId): boolean {
    const leaf = this.leafLookup.get(id);
    if (!leaf) {
      return false;
    }
    const idx = leaf.entries.findIndex((entry) => entry.id === id);
    if (idx === -1) {
      this.leafLookup.delete(id);
      this.entryLookup.delete(id);
      return false;
    }
    leaf.entries.splice(idx, 1);
    this.leafLookup.delete(id);
    this.entryLookup.delete(id);
    this.condenseTree(leaf);
    return true;
  }

  private ensureRect(rect: HyperRect): void {
    if (
      rect.min.length !== this.dim ||
      rect.max.length !== this.dim
    ) {
      throw new Error(`rtree_dim_mismatch_${this.dim}`);
    }
  }

  private normalizeRect(rect: HyperRect): HyperRect {
    const min = new Float32Array(this.dim);
    const max = new Float32Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      const lo = Math.min(rect.min[i]!, rect.max[i]!);
      const hi = Math.max(rect.min[i]!, rect.max[i]!);
      min[i] = lo;
      max[i] = hi;
    }
    return { min, max };
  }

  private chooseLeaf(node: RTreeNode, rect: HyperRect): RTreeNode {
    if (node.leaf) {
      return node;
    }
    let best: NodeEntry | null = null;
    let bestEnlargement = Number.POSITIVE_INFINITY;
    let bestArea = Number.POSITIVE_INFINITY;
    for (const entry of node.entries) {
      const enlargement = this.enlargement(entry.rect, rect);
      if (enlargement < bestEnlargement) {
        best = entry;
        bestEnlargement = enlargement;
        bestArea = this.measure(entry.rect);
      } else if (enlargement === bestEnlargement) {
        const area = this.measure(entry.rect);
        if (area < bestArea) {
          best = entry;
          bestArea = area;
        }
      }
    }
    if (!best || !best.child) {
      throw new Error("rtree_choose_leaf_failed");
    }
    return this.chooseLeaf(best.child, rect);
  }

  private adjustTree(node: RTreeNode): void {
    let current: RTreeNode | null = node;
    while (current) {
      this.updateParentRect(current);
      if (current.entries.length > this.maxEntries) {
        const sibling = this.splitNode(current);
        if (current.parent) {
          current.parent.entries.push({
            rect: this.computeNodeRect(sibling),
            child: sibling,
          });
          sibling.parent = current.parent;
        } else {
          const newRoot = new RTreeNode(false, null);
          newRoot.entries.push({
            rect: this.computeNodeRect(current),
            child: current,
          });
          newRoot.entries.push({
            rect: this.computeNodeRect(sibling),
            child: sibling,
          });
          current.parent = newRoot;
          sibling.parent = newRoot;
          this.root = newRoot;
        }
      }
      current = current.parent;
    }
    if (!this.root.leaf && this.root.entries.length === 1) {
      const child = this.root.entries[0]?.child;
      if (child) {
        child.parent = null;
        this.root = child;
      }
    }
  }

  private splitNode(node: RTreeNode): RTreeNode {
    const entries = node.entries.slice();
    const groupA: NodeEntry[] = [];
    const groupB: NodeEntry[] = [];
    const seeds = this.pickSeeds(entries);
    groupA.push(seeds[0]!);
    groupB.push(seeds[1]!);
    const remaining = entries.filter((entry) => entry !== seeds[0] && entry !== seeds[1]);

    while (remaining.length > 0) {
      if (
        groupA.length + remaining.length === this.minEntries
      ) {
        groupA.push(...remaining.splice(0));
        break;
      }
      if (
        groupB.length + remaining.length === this.minEntries
      ) {
        groupB.push(...remaining.splice(0));
        break;
      }
      const next = this.pickNext(
        remaining,
        this.groupRect(groupA),
        this.groupRect(groupB)
      );
      const diff =
        this.enlargement(this.groupRect(groupA), next.rect) -
        this.enlargement(this.groupRect(groupB), next.rect);
      if (diff < 0) {
        groupA.push(next);
      } else if (diff > 0) {
        groupB.push(next);
      } else {
        const areaA = this.measure(this.groupRect(groupA));
        const areaB = this.measure(this.groupRect(groupB));
        if (areaA < areaB) {
          groupA.push(next);
        } else if (areaB < areaA) {
          groupB.push(next);
        } else if (groupA.length <= groupB.length) {
          groupA.push(next);
        } else {
          groupB.push(next);
        }
      }
      remaining.splice(remaining.indexOf(next), 1);
    }

    node.entries.splice(0, node.entries.length, ...groupA);
    const sibling = new RTreeNode(node.leaf, node.parent);
    sibling.entries.push(...groupB);
    if (node.leaf) {
      for (const entry of sibling.entries) {
        if (entry.id) {
          this.leafLookup.set(entry.id, sibling);
        }
      }
    } else {
      for (const entry of sibling.entries) {
        if (entry.child) {
          entry.child.parent = sibling;
        }
      }
    }
    this.tighten(node);
    this.tighten(sibling);
    return sibling;
  }

  private pickSeeds(entries: NodeEntry[]): [NodeEntry, NodeEntry] {
    let maxWaste = -1;
    let seed1: NodeEntry | null = null;
    let seed2: NodeEntry | null = null;
    for (let i = 0; i < entries.length - 1; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const rect = this.combine(entries[i]!.rect, entries[j]!.rect);
        const waste =
          this.measure(rect) -
          this.measure(entries[i]!.rect) -
          this.measure(entries[j]!.rect);
        if (waste > maxWaste) {
          maxWaste = waste;
          seed1 = entries[i]!;
          seed2 = entries[j]!;
        }
      }
    }
    if (!seed1 || !seed2) {
      throw new Error("rtree_pick_seeds_failed");
    }
    return [seed1, seed2];
  }

  private pickNext(
    entries: NodeEntry[],
    rectA: HyperRect,
    rectB: HyperRect
  ): NodeEntry {
    let maxDiff = -1;
    let next: NodeEntry | null = null;
    for (const entry of entries) {
      const diff =
        Math.abs(this.enlargement(rectA, entry.rect) -
        this.enlargement(rectB, entry.rect));
      if (diff > maxDiff) {
        maxDiff = diff;
        next = entry;
      }
    }
    if (!next) {
      throw new Error("rtree_pick_next_failed");
    }
    return next;
  }

  private groupRect(entries: NodeEntry[]): HyperRect {
    if (entries.length === 0) {
      return {
        min: new Float32Array(this.dim),
        max: new Float32Array(this.dim),
      };
    }
    let rect = entries[0]!.rect;
    for (let i = 1; i < entries.length; i++) {
      rect = this.combine(rect, entries[i]!.rect);
    }
    return rect;
  }

  private updateParentRect(node: RTreeNode): void {
    const parent = node.parent;
    if (!parent) {
      return;
    }
    const entry = parent.entries.find((e) => e.child === node);
    if (entry) {
      entry.rect = this.computeNodeRect(node);
    }
  }

  private computeNodeRect(node: RTreeNode): HyperRect {
    if (node.entries.length === 0) {
      const min = new Float32Array(this.dim);
      const max = new Float32Array(this.dim);
      return { min, max };
    }
    let min = new Float32Array(node.entries[0]!.rect.min);
    let max = new Float32Array(node.entries[0]!.rect.max);
    for (let i = 1; i < node.entries.length; i++) {
      const entry = node.entries[i]!;
      for (let d = 0; d < this.dim; d++) {
        if (entry.rect.min[d]! < min[d]!) {
          min[d] = entry.rect.min[d]!;
        }
        if (entry.rect.max[d]! > max[d]!) {
          max[d] = entry.rect.max[d]!;
        }
      }
    }
    return { min, max };
  }

  private condenseTree(start: RTreeNode): void {
    let node: RTreeNode | null = start;
    const reinserts: NodeEntry[] = [];
    while (node) {
      if (node !== this.root && node.entries.length < this.minEntries) {
        const parent = node.parent!;
        const idx = parent.entries.findIndex((entry) => entry.child === node);
        if (idx >= 0) {
          parent.entries.splice(idx, 1);
        }
        reinserts.push(...this.collectLeafEntries(node));
      } else if (!node.leaf) {
        this.tighten(node);
      }
      node = node.parent;
    }
    if (!this.root.leaf && this.root.entries.length === 1) {
      const child = this.root.entries[0]?.child;
      if (child) {
        child.parent = null;
        this.root = child;
      }
    } else if (this.root.entries.length === 0) {
      this.root = new RTreeNode(true, null);
    }
    for (const entry of reinserts) {
      if (entry.id) {
        this.insert(entry.rect, entry.id);
      }
    }
  }

  private collectLeafEntries(node: RTreeNode): NodeEntry[] {
    if (node.leaf) {
      const entries = node.entries.slice();
      for (const entry of entries) {
        if (entry.id) {
          this.leafLookup.delete(entry.id);
          this.entryLookup.delete(entry.id);
        }
      }
      return entries;
    }
    const acc: NodeEntry[] = [];
    for (const entry of node.entries) {
      if (entry.child) {
        acc.push(...this.collectLeafEntries(entry.child));
      }
    }
    return acc;
  }

  private combine(a: HyperRect, b: HyperRect): HyperRect {
    const min = new Float32Array(this.dim);
    const max = new Float32Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      min[i] = Math.min(a.min[i]!, b.min[i]!);
      max[i] = Math.max(a.max[i]!, b.max[i]!);
    }
    return { min, max };
  }

  private measure(rect: HyperRect): number {
    let sum = 0;
    for (let i = 0; i < this.dim; i++) {
      const span = Math.max(rect.max[i]! - rect.min[i]!, 0);
      sum += Math.log1p(span);
    }
    return sum;
  }

  private enlargement(base: HyperRect, added: HyperRect): number {
    const combined = this.combine(base, added);
    return this.measure(combined) - this.measure(base);
  }

  private intersects(a: HyperRect, b: HyperRect): boolean {
    for (let i = 0; i < this.dim; i++) {
      if (a.min[i]! > b.max[i]! || a.max[i]! < b.min[i]!) {
        return false;
      }
    }
    return true;
  }

  private distancePointRect(point: Float32Array, rect: HyperRect): number {
    let sum = 0;
    for (let i = 0; i < this.dim; i++) {
      const p = point[i]!;
      const min = rect.min[i]!;
      const max = rect.max[i]!;
      let delta = 0;
      if (p < min) {
        delta = min - p;
      } else if (p > max) {
        delta = p - max;
      }
      sum += delta * delta;
    }
    return Math.sqrt(sum);
  }

  private insertResult(
    results: Array<{ id: NodeId; dist: number }>,
    entry: { id: NodeId; dist: number },
    k: number
  ): void {
    let inserted = false;
    for (let i = 0; i < results.length; i++) {
      if (entry.dist < results[i]!.dist) {
        results.splice(i, 0, entry);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      results.push(entry);
    }
    if (results.length > k) {
      results.pop();
    }
  }
}
