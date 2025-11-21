const isRed = (node) => node?.color === "R";
const maxTimestamp = (a, b, c) => Math.max(a, b, c);
const overlaps = (interval, start, end) => interval.start <= end && interval.end >= start;
const normalize = (interval) => {
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
    root = null;
    count = 0;
    insert(interval) {
        const normalized = normalize(interval);
        const node = {
            interval: normalized,
            maxEnd: normalized.end,
            color: "R",
            left: null,
            right: null,
            parent: null,
        };
        let parent = null;
        let current = this.root;
        while (current) {
            parent = current;
            if (node.interval.start < current.interval.start) {
                current = current.left;
            }
            else {
                current = current.right;
            }
        }
        node.parent = parent;
        if (!parent) {
            this.root = node;
        }
        else if (node.interval.start < parent.interval.start) {
            parent.left = node;
        }
        else {
            parent.right = node;
        }
        this.count++;
        this.updateAugmentationUpwards(node);
        this.fixAfterInsert(node);
    }
    queryPoint(ts) {
        return this.queryRange(ts, ts);
    }
    queryRange(start, end) {
        const acc = [];
        this.search(this.root, start, end, acc);
        return acc;
    }
    size() {
        return this.count;
    }
    search(node, start, end, acc) {
        if (!node)
            return;
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
    fixAfterInsert(node) {
        let current = node;
        while (current && current.parent && isRed(current.parent)) {
            const parent = current.parent;
            const grandparent = parent.parent;
            if (!grandparent)
                break;
            if (parent === grandparent.left) {
                const uncle = grandparent.right;
                if (isRed(uncle)) {
                    parent.color = "B";
                    if (uncle)
                        uncle.color = "B";
                    grandparent.color = "R";
                    current = grandparent;
                }
                else {
                    if (current === parent.right) {
                        current = parent;
                        this.rotateLeft(current);
                    }
                    current.parent.color = "B";
                    grandparent.color = "R";
                    this.rotateRight(grandparent);
                }
            }
            else {
                const uncle = grandparent.left;
                if (isRed(uncle)) {
                    parent.color = "B";
                    if (uncle)
                        uncle.color = "B";
                    grandparent.color = "R";
                    current = grandparent;
                }
                else {
                    if (current === parent.left) {
                        current = parent;
                        this.rotateRight(current);
                    }
                    current.parent.color = "B";
                    grandparent.color = "R";
                    this.rotateLeft(grandparent);
                }
            }
        }
        if (this.root) {
            this.root.color = "B";
        }
    }
    rotateLeft(x) {
        const y = x.right;
        if (!y)
            return;
        x.right = y.left;
        if (y.left) {
            y.left.parent = x;
        }
        y.parent = x.parent;
        if (!x.parent) {
            this.root = y;
        }
        else if (x === x.parent.left) {
            x.parent.left = y;
        }
        else {
            x.parent.right = y;
        }
        y.left = x;
        x.parent = y;
        this.updateAugmentation(x);
        this.updateAugmentation(y);
    }
    rotateRight(y) {
        const x = y.left;
        if (!x)
            return;
        y.left = x.right;
        if (x.right) {
            x.right.parent = y;
        }
        x.parent = y.parent;
        if (!y.parent) {
            this.root = x;
        }
        else if (y === y.parent.left) {
            y.parent.left = x;
        }
        else {
            y.parent.right = x;
        }
        x.right = y;
        y.parent = x;
        this.updateAugmentation(y);
        this.updateAugmentation(x);
    }
    updateAugmentation(node) {
        const leftMax = node.left?.maxEnd ?? node.interval.end;
        const rightMax = node.right?.maxEnd ?? node.interval.end;
        node.maxEnd = maxTimestamp(node.interval.end, leftMax, rightMax);
    }
    updateAugmentationUpwards(node) {
        let current = node;
        while (current) {
            this.updateAugmentation(current);
            current = current.parent;
        }
    }
}
//# sourceMappingURL=interval-tree.js.map