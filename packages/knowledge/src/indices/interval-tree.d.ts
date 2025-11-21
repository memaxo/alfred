import type { NodeId, Timestamp } from "../hypergraph.js";
export type Interval = {
  start: Timestamp;
  end: Timestamp;
  id: NodeId;
};
export declare class IntervalTree {
  private root;
  private count;
  insert(interval: Interval): void;
  queryPoint(ts: Timestamp): NodeId[];
  queryRange(start: Timestamp, end: Timestamp): NodeId[];
  size(): number;
  private search;
  private fixAfterInsert;
  private rotateLeft;
  private rotateRight;
  private updateAugmentation;
  private updateAugmentationUpwards;
}
//# sourceMappingURL=interval-tree.d.ts.map
