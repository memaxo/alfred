import type { NodeId, Timestamp } from "../hypergraph.js";

export interface Interval {
  start: Timestamp;
  end: Timestamp;
  id: NodeId;
}

type Color = "R" | "B";

interface Node {
  interval: Interval;
  maxEnd: Timestamp;
  color: Color;
  left: Node | null;
  right: Node | null;
  parent: Node | null;
}

const isRed = (node: Node | null): boolean => node?.color === "R";
const maxTimestamp = (a: Timestamp, b: Timestamp, c: Timestamp): Timestamp =>
  Math.max(a, b, c) as Timestamp;

const overlaps = (interval: Interval, start: Timestamp, end: Timestamp) =>
  interval.start <= end && interval.end >= start;

const normalize = (interval: Interval): Interval => {
  if (interval.end >= interval.start) {
    return interval;
  }
  return {
    ...interval,
    start: interval.end,
    end: interval.start,
  };
};

export class IntervalTree {
  private root: Node | null = null;
  private count = 0;

  insert(interval: Interval): void {
    const normalized = normalize(interval);
    const node: Node = {
      interval: normalized,
      maxEnd: normalized.end,
      color: "R",
      left: null,
      right: null,
      parent: null,
    };

    let parent: Node | null = null;
    let current = this.root;
    while (current) {
      parent = current;
      if (node.interval.start < current.interval.start) {
        current = current.left;
      } else {
        current = current.right;
      }
    }

    node.parent = parent;
    if (!parent) {
      this.root = node;
    } else if (node.interval.start < parent.interval.start) {
      parent.left = node;
    } else {
      parent.right = node;
    }

    this.count++;
    this.updateAugmentationUpwards(node);
    this.fixAfterInsert(node);
  }

  queryPoint(ts: Timestamp): NodeId[] {
    return this.queryRange(ts, ts);
  }

  queryRange(start: Timestamp, end: Timestamp): NodeId[] {
    const acc: NodeId[] = [];
    this.search(this.root, start, end, acc);
    return acc;
  }

  size(): number {
    return this.count;
  }

  private search(
    node: Node | null,
    start: Timestamp,
    end: Timestamp,
    acc: NodeId[]
  ): void {
    if (!node) {
      return;
    }

    if (node.left && node.left.maxEnd >= start) {
      this.search(node.left, start, end, acc);
    }

    if (overlaps(node.interval, start, end)) {
      acc.push(node.interval.id);
    }

    if (node.right && node.interval.start <= end) {
      this.search(node.right, start, end, acc);
    }
  }

  private fixAfterInsert(node: Node): void {
    let current: Node | null = node;
    while (current?.parent && isRed(current.parent)) {
      const p: Node | null = current.parent;
      if (!p) {
        break;
      }
      const grandparent: Node | null = p.parent;
      if (!grandparent) {
        break;
      }
      if (p === grandparent.left) {
        const uncle = grandparent.right;
        if (isRed(uncle)) {
          p.color = "B";
          if (uncle) {
            uncle.color = "B";
          }
          grandparent.color = "R";
          current = grandparent;
        } else {
          if (current === p.right) {
            current = p;
            if (current) {
              this.rotateLeft(current);
            }
          }
          if (current?.parent) {
            current.parent.color = "B";
          }
          grandparent.color = "R";
          this.rotateRight(grandparent);
        }
      } else {
        const uncle = grandparent.left;
        if (isRed(uncle)) {
          p.color = "B";
          if (uncle) {
            uncle.color = "B";
          }
          grandparent.color = "R";
          current = grandparent;
        } else {
          if (current === p.left) {
            current = p;
            if (current) {
              this.rotateRight(current);
            }
          }
          if (current?.parent) {
            current.parent.color = "B";
          }
          grandparent.color = "R";
          this.rotateLeft(grandparent);
        }
      }
    }
    if (this.root) {
      this.root.color = "B";
    }
  }

  private rotateLeft(x: Node): void {
    const y = x.right;
    if (!y) {
      return;
    }

    x.right = y.left;
    if (y.left) {
      y.left.parent = x;
    }
    y.parent = x.parent;
    if (!x.parent) {
      this.root = y;
    } else if (x === x.parent.left) {
      x.parent.left = y;
    } else {
      x.parent.right = y;
    }
    y.left = x;
    x.parent = y;

    this.updateAugmentation(x);
    this.updateAugmentation(y);
  }

  private rotateRight(y: Node): void {
    const x = y.left;
    if (!x) {
      return;
    }

    y.left = x.right;
    if (x.right) {
      x.right.parent = y;
    }
    x.parent = y.parent;
    if (!y.parent) {
      this.root = x;
    } else if (y === y.parent.left) {
      y.parent.left = x;
    } else {
      y.parent.right = x;
    }
    x.right = y;
    y.parent = x;

    this.updateAugmentation(y);
    this.updateAugmentation(x);
  }

  private updateAugmentation(node: Node): void {
    const leftMax = node.left?.maxEnd ?? node.interval.end;
    const rightMax = node.right?.maxEnd ?? node.interval.end;
    node.maxEnd = maxTimestamp(node.interval.end, leftMax, rightMax);
  }

  private updateAugmentationUpwards(node: Node): void {
    let current: Node | null = node;
    while (current) {
      this.updateAugmentation(current);
      current = current.parent;
    }
  }
}
