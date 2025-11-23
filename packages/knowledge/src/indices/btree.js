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
    if (a === b) {
        return 0;
    }
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
            while (i >= 0) {
                const k = node.keys[i];
                if (k !== undefined && this.compare(key, k) < 0) {
                    i--;
                }
                else {
                    break;
                }
            }
            const k = node.keys[i];
            if (i >= 0 && k !== undefined && this.compare(key, k) === 0) {
                node.values[i]?.push(value);
                return;
            }
            node.keys.splice(i + 1, 0, key);
            node.values.splice(i + 1, 0, [value]);
            return;
        }
        let idx = node.keys.length - 1;
        while (idx >= 0) {
            const k = node.keys[idx];
            if (k !== undefined && this.compare(key, k) < 0) {
                idx--;
            }
            else {
                break;
            }
        }
        idx++;
        if (node.children[idx]?.keys.length === this.maxKeys) {
            this.splitChild(node, idx);
            const k = node.keys[idx];
            if (k !== undefined && this.compare(key, k) > 0) {
                idx++;
            }
            else if (k !== undefined && this.compare(key, k) === 0) {
                node.values[idx]?.push(value);
                return;
            }
        }
        const child = node.children[idx];
        if (child) {
            this.insertNonFull(child, key, value);
        }
    }
    splitChild(parent, index) {
        const child = parent.children[index];
        if (!child) {
            throw new Error("splitChild: child not found");
        }
        const mid = Math.floor(child.keys.length / 2);
        const medianKey = child.keys[mid];
        if (medianKey === undefined) {
            throw new Error("splitChild: medianKey not found");
        }
        const medianValues = child.values[mid];
        if (!medianValues) {
            throw new Error("splitChild: medianValues not found");
        }
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
        while (i < node.keys.length) {
            const k = node.keys[i];
            if (k !== undefined && this.compare(k, start) < 0) {
                if (!node.leaf) {
                    const child = node.children[i];
                    if (child) {
                        this.rangeInternal(child, start, end, acc);
                    }
                }
                i++;
            }
            else {
                break;
            }
        }
        for (; i < node.keys.length; i++) {
            if (!node.leaf) {
                const child = node.children[i];
                if (child) {
                    this.rangeInternal(child, start, end, acc);
                }
            }
            const k = node.keys[i];
            if (k === undefined) {
                continue;
            }
            if (this.compare(k, start) >= 0 && this.compare(k, end) <= 0) {
                const vals = node.values[i];
                if (vals) {
                    acc.push(...vals);
                }
            }
            if (this.compare(k, end) > 0) {
                if (!node.leaf) {
                    const child = node.children[i + 1];
                    if (child) {
                        this.rangeInternal(child, start, end, acc);
                    }
                }
                return;
            }
        }
        if (!node.leaf) {
            const child = node.children[node.keys.length];
            if (child) {
                this.rangeInternal(child, start, end, acc);
            }
        }
    }
    search(node, key) {
        let i = 0;
        while (i < node.keys.length) {
            const k = node.keys[i];
            if (k !== undefined && this.compare(key, k) > 0) {
                i++;
            }
            else {
                break;
            }
        }
        const k = node.keys[i];
        if (i < node.keys.length && k !== undefined && this.compare(key, k) === 0) {
            return node.values[i];
        }
        if (node.leaf) {
            return;
        }
        const child = node.children[i];
        if (child) {
            return this.search(child, key);
        }
        return;
    }
    collectAll(node, acc) {
        if (node.leaf) {
            for (let i = 0; i < node.keys.length; i++) {
                const key = node.keys[i];
                const values = node.values[i];
                if (key !== undefined && values) {
                    for (const value of values) {
                        acc.push({ key, value });
                    }
                }
            }
            return;
        }
        for (let i = 0; i < node.keys.length; i++) {
            const child = node.children[i];
            if (child) {
                this.collectAll(child, acc);
            }
            const key = node.keys[i];
            const values = node.values[i];
            if (key !== undefined && values) {
                for (const value of values) {
                    acc.push({ key, value });
                }
            }
        }
        const child = node.children[node.keys.length];
        if (child) {
            this.collectAll(child, acc);
        }
    }
}
