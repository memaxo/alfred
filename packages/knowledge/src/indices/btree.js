class BTreeNode {
    leaf;
    keys = [];
    values = [];
    children = [];
    constructor(leaf) {
        this.leaf = leaf;
    }
}
const defaultCompare = (a, b) => {
    if (a === b)
        return 0;
    return a < b ? -1 : 1;
};
export class BTreeIndex {
    order;
    compare;
    root;
    maxKeys;
    minKeys;
    constructor(order = 64, compare = defaultCompare) {
        this.order = order;
        this.compare = compare;
        if (this.order < 4) {
            throw new Error("btree_order_invalid");
        }
        this.maxKeys = this.order - 1;
        this.minKeys = Math.ceil(this.order / 2) - 1;
        this.root = new BTreeNode(true);
    }
    insert(key, value) {
        if (this.root.keys.length === this.maxKeys) {
            const newRoot = new BTreeNode(false);
            newRoot.children.push(this.root);
            this.splitChild(newRoot, 0);
            this.root = newRoot;
        }
        this.insertNonFull(this.root, key, value);
    }
    range(start, end) {
        const acc = [];
        this.rangeInternal(this.root, start, end, acc);
        return acc;
    }
    get(key) {
        const found = this.search(this.root, key);
        return found ? [...found] : [];
    }
    delete(key, value) {
        const all = [];
        this.collectAll(this.root, all);
        let removed = false;
        const filtered = [];
        for (const entry of all) {
            if (this.compare(entry.key, key) === 0) {
                if (value === undefined) {
                    removed = true;
                    continue;
                }
                if (!removed && entry.value === value) {
                    removed = true;
                    continue;
                }
            }
            filtered.push(entry);
        }
        if (!removed) {
            return false;
        }
        this.root = new BTreeNode(true);
        for (const entry of filtered) {
            this.insert(entry.key, entry.value);
        }
        return true;
    }
    insertNonFull(node, key, value) {
        if (node.leaf) {
            let i = node.keys.length - 1;
            while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
                i--;
            }
            if (i >= 0 && this.compare(key, node.keys[i]) === 0) {
                node.values[i].push(value);
                return;
            }
            node.keys.splice(i + 1, 0, key);
            node.values.splice(i + 1, 0, [value]);
            return;
        }
        let idx = node.keys.length - 1;
        while (idx >= 0 && this.compare(key, node.keys[idx]) < 0) {
            idx--;
        }
        idx++;
        if (node.children[idx].keys.length === this.maxKeys) {
            this.splitChild(node, idx);
            if (this.compare(key, node.keys[idx]) > 0) {
                idx++;
            }
            else if (this.compare(key, node.keys[idx]) === 0) {
                node.values[idx].push(value);
                return;
            }
        }
        this.insertNonFull(node.children[idx], key, value);
    }
    splitChild(parent, index) {
        const child = parent.children[index];
        const mid = Math.floor(child.keys.length / 2);
        const medianKey = child.keys[mid];
        const medianValues = child.values[mid];
        const right = new BTreeNode(child.leaf);
        right.keys = child.keys.slice(mid + 1);
        right.values = child.values.slice(mid + 1);
        if (!child.leaf) {
            right.children = child.children.slice(mid + 1);
            child.children = child.children.slice(0, mid + 1);
        }
        child.keys = child.keys.slice(0, mid);
        child.values = child.values.slice(0, mid);
        parent.keys.splice(index, 0, medianKey);
        parent.values.splice(index, 0, [...medianValues]);
        parent.children.splice(index + 1, 0, right);
    }
    rangeInternal(node, start, end, acc) {
        let i = 0;
        while (i < node.keys.length && this.compare(node.keys[i], start) < 0) {
            if (!node.leaf) {
                this.rangeInternal(node.children[i], start, end, acc);
            }
            i++;
        }
        for (; i < node.keys.length; i++) {
            if (!node.leaf) {
                this.rangeInternal(node.children[i], start, end, acc);
            }
            if (this.compare(node.keys[i], start) >= 0 &&
                this.compare(node.keys[i], end) <= 0) {
                acc.push(...node.values[i]);
            }
            if (this.compare(node.keys[i], end) > 0) {
                if (!node.leaf) {
                    this.rangeInternal(node.children[i + 1], start, end, acc);
                }
                return;
            }
        }
        if (!node.leaf && node.children[node.keys.length]) {
            this.rangeInternal(node.children[node.keys.length], start, end, acc);
        }
    }
    search(node, key) {
        let i = 0;
        while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
            i++;
        }
        if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
            return node.values[i];
        }
        if (node.leaf) {
            return undefined;
        }
        return this.search(node.children[i], key);
    }
    collectAll(node, acc) {
        if (node.leaf) {
            for (let i = 0; i < node.keys.length; i++) {
                for (const value of node.values[i]) {
                    acc.push({ key: node.keys[i], value });
                }
            }
            return;
        }
        for (let i = 0; i < node.keys.length; i++) {
            this.collectAll(node.children[i], acc);
            for (const value of node.values[i]) {
                acc.push({ key: node.keys[i], value });
            }
        }
        this.collectAll(node.children[node.keys.length], acc);
    }
}
//# sourceMappingURL=btree.js.map