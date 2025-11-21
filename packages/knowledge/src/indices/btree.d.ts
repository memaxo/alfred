import type { NodeId } from "../hypergraph.js";
type Compare<K> = (a: K, b: K) => number;
export declare class BTreeIndex<K = string, V = NodeId> {
    readonly order: number;
    readonly compare: Compare<K>;
    private root;
    private readonly maxKeys;
    private readonly minKeys;
    constructor(order?: number, compare?: Compare<K>);
    insert(key: K, value: V): void;
    range(start: K, end: K): V[];
    get(key: K): V[];
    delete(key: K, value?: V): boolean;
    private insertNonFull;
    private splitChild;
    private rangeInternal;
    private search;
    private collectAll;
}
export {};
//# sourceMappingURL=btree.d.ts.map