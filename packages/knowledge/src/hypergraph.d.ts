/**
 * Knowledge Hypergraph Implementation
 * Zero-allocation design with content-addressed nodes
 */
export type NodeId = string & {
    readonly _: unique symbol;
};
export type Confidence = number & {
    readonly _: unique symbol;
    readonly min: 0;
    readonly max: 1;
};
export type Timestamp = number & {
    readonly _: unique symbol;
};
export type Knowledge = {
    _: "fact";
    content: string;
    confidence: Confidence;
    source: string;
    ts: Timestamp;
} | {
    _: "relation";
    from: NodeId;
    to: NodeId;
    kind: string;
    weight: number;
} | {
    _: "insight";
    derived: NodeId[];
    conclusion: string;
    confidence: Confidence;
} | {
    _: "pattern";
    examples: NodeId[];
    rule: string;
    accuracy: number;
};
export declare const toConfidence: (n: number) => Confidence;
export declare const timestamp: (n: number) => Timestamp;
export declare const nodeFromHash: (hash: string) => NodeId;
export declare const knowledgeHash: (k: Knowledge) => string;
export declare class Hypergraph {
    private readonly nodes;
    private readonly temporal;
    private readonly spatial;
    private readonly ordered;
    private readonly edges;
    private readonly inbound;
    private readonly edgesByKind;
    private readonly inboundByKind;
    private readonly dirty;
    private readonly embeddings;
    private nodeCount;
    private modCount;
    add(k: Knowledge): NodeId;
    get(id: NodeId): Knowledge | undefined;
    neighbors(id: NodeId): NodeId[];
    between(start: Timestamp, end: Timestamp): NodeId[];
    predecessors(id: NodeId): NodeId[];
    neighborsByKind(id: NodeId, kind?: string): NodeId[];
    predecessorsByKind(id: NodeId, kind?: string): NodeId[];
    entries(): IterableIterator<[NodeId, Knowledge]>;
    ids(): IterableIterator<NodeId>;
    size(): number;
    version(): number;
    setEmbedding(id: NodeId, vector: Float32Array): void;
    getEmbedding(id: NodeId): Float32Array | undefined;
    embeddingEntries(): IterableIterator<[NodeId, Float32Array]>;
    embeddingCount(): number;
    getDirty(): NodeId[];
    markClean(ids?: NodeId[]): void;
    search(pattern: string): NodeId[];
    private contentAddress;
    private ensureKindBucket;
}
export declare const empty: () => Hypergraph;
export declare const fact: (content: string, conf: number, source: string) => Knowledge;
export declare const relation: (from: NodeId, to: NodeId, kind: string, weight?: number) => Knowledge;
export declare const insight: (derived: NodeId[], conclusion: string, conf: number) => Knowledge;
export declare const pattern: (examples: NodeId[], rule: string, accuracy: number) => Knowledge;
//# sourceMappingURL=hypergraph.d.ts.map