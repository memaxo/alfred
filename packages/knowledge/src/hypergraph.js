/**
 * Knowledge Hypergraph Implementation
 * Zero-allocation design with content-addressed nodes
 */
import { IntervalTree } from "./indices/interval-tree.js";
import { RTreeND } from "./indices/rtree.js";
import { BTreeIndex } from "./indices/btree.js";
// Brand constructors with validation
const nodeId = (s) => s;
export const toConfidence = (n) => {
    if (n < 0 || n > 1)
        throw new Error("Invalid confidence");
    return n;
};
export const timestamp = (n) => n;
export const nodeFromHash = (hash) => nodeId(hash);
export const knowledgeHash = (k) => {
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
const hashString = (input) => {
    let h = 2_166_136_261;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = (h * 16_777_619) >>> 0;
    }
    return h.toString(36);
};
// HAMT (Hash Array Mapped Trie) for O(1) content addressing
class HAMT {
    root = new Map();
    set(key, value) {
        const hash = this.hash(key);
        const bucket = hash & 0xff;
        if (!this.root.has(bucket)) {
            this.root.set(bucket, new Map());
        }
        this.root.get(bucket).set(key, value);
    }
    get(key) {
        const hash = this.hash(key);
        const bucket = hash & 0xff;
        return this.root.get(bucket)?.get(key);
    }
    *entries() {
        for (const bucket of this.root.values()) {
            for (const entry of bucket.entries()) {
                yield entry;
            }
        }
    }
    hash(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        }
        return h;
    }
}
// Main Hypergraph
export class Hypergraph {
    nodes = new HAMT();
    temporal = new IntervalTree();
    spatial = new RTreeND(1024);
    ordered = new BTreeIndex(64);
    edges = new Map();
    inbound = new Map();
    edgesByKind = new Map();
    inboundByKind = new Map();
    dirty = new Set();
    embeddings = new Map();
    nodeCount = 0;
    modCount = 0;
    add(k) {
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
                case "relation":
                    if (!this.edges.has(k.from))
                        this.edges.set(k.from, new Set());
                    this.edges.get(k.from).add(k.to);
                    if (!this.inbound.has(k.to))
                        this.inbound.set(k.to, new Set());
                    this.inbound.get(k.to).add(k.from);
                    const outboundKind = this.ensureKindBucket(this.edgesByKind, k.kind, k.from);
                    outboundKind.add(k.to);
                    const inboundKind = this.ensureKindBucket(this.inboundByKind, k.kind, k.to);
                    inboundKind.add(k.from);
                    break;
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
    get(id) {
        return this.nodes.get(id);
    }
    // O(1) relation traversal
    neighbors(id) {
        return Array.from(this.edges.get(id) || []);
    }
    // Temporal queries
    between(start, end) {
        let rangeStart = start;
        let rangeEnd = end;
        if (rangeEnd < rangeStart) {
            [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
        }
        return this.temporal.queryRange(rangeStart, rangeEnd);
    }
    predecessors(id) {
        return Array.from(this.inbound.get(id) ?? []);
    }
    neighborsByKind(id, kind) {
        if (!kind) {
            return this.neighbors(id);
        }
        const bucket = this.edgesByKind.get(kind)?.get(id);
        return bucket ? Array.from(bucket) : [];
    }
    predecessorsByKind(id, kind) {
        if (!kind) {
            return this.predecessors(id);
        }
        const bucket = this.inboundByKind.get(kind)?.get(id);
        return bucket ? Array.from(bucket) : [];
    }
    *entries() {
        for (const [key, value] of this.nodes.entries()) {
            yield [nodeId(key), value];
        }
    }
    *ids() {
        for (const [key] of this.nodes.entries()) {
            yield nodeId(key);
        }
    }
    size() {
        return this.nodeCount;
    }
    version() {
        return this.modCount;
    }
    setEmbedding(id, vector) {
        if (vector.length !== 1024) {
            throw new Error("embedding_dim_mismatch_1024");
        }
        const stored = vector instanceof Float32Array ? vector : new Float32Array(vector);
        this.embeddings.set(id, stored);
        this.spatial.insertPoint(stored, id);
        this.modCount++;
    }
    getEmbedding(id) {
        return this.embeddings.get(id);
    }
    *embeddingEntries() {
        for (const [key, value] of this.embeddings.entries()) {
            yield [key, value];
        }
    }
    embeddingCount() {
        return this.embeddings.size;
    }
    getDirty() {
        return Array.from(this.dirty);
    }
    markClean(ids) {
        if (ids && ids.length > 0) {
            for (const id of ids) {
                this.dirty.delete(id);
            }
        }
        else {
            this.dirty.clear();
        }
    }
    // Content queries
    search(pattern) {
        // For MVP, use BTree range query
        return this.ordered.range(pattern, pattern + "\xFF");
    }
    contentAddress(k) {
        return knowledgeHash(k);
    }
    ensureKindBucket(map, kind, node) {
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
export const empty = () => new Hypergraph();
export const fact = (content, conf, source) => ({
    _: "fact",
    content,
    confidence: toConfidence(conf),
    source,
    ts: timestamp(Date.now()),
});
export const relation = (from, to, kind, weight = 1.0) => ({
    _: "relation",
    from,
    to,
    kind,
    weight,
});
export const insight = (derived, conclusion, conf) => ({
    _: "insight",
    derived,
    conclusion,
    confidence: toConfidence(conf),
});
export const pattern = (examples, rule, accuracy) => ({
    _: "pattern",
    examples,
    rule,
    accuracy,
});
//# sourceMappingURL=hypergraph.js.map