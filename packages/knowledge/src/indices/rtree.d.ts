import type { NodeId } from "../hypergraph.js";
export type HyperRect = {
  min: Float32Array;
  max: Float32Array;
};
export declare class RTreeND {
  readonly dim: number;
  readonly maxEntries: number;
  private root;
  private readonly leafLookup;
  private readonly entryLookup;
  private readonly minEntries;
  constructor(dim?: number, maxEntries?: number, minEntries?: number);
  insertPoint(vec: Float32Array, id: NodeId): void;
  insert(rect: HyperRect, id: NodeId): void;
  search(rect: HyperRect): NodeId[];
  nearestK(
    point: Float32Array,
    k: number
  ): Array<{
    id: NodeId;
    dist: number;
  }>;
  remove(id: NodeId): boolean;
  private ensureRect;
  private normalizeRect;
  private chooseLeaf;
  private adjustTree;
  private splitNode;
  private pickSeeds;
  private pickNext;
  private groupRect;
  private updateParentRect;
  private computeNodeRect;
  private condenseTree;
  private collectLeafEntries;
  private combine;
  private measure;
  private enlargement;
  private intersects;
  private distancePointRect;
  private insertResult;
}
//# sourceMappingURL=rtree.d.ts.map
