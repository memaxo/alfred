import type { NodeId } from "../hypergraph.js";

type Compare<K> = (a: K, b: K) => number;

class BTreeNode<K, V> {
  keys: K[] = [];
  values: V[][] = [];
  children: BTreeNode<K, V>[] = [];
  constructor(readonly leaf: boolean) {}
}

const defaultCompare = (a: unknown, b: unknown): number => {
  if (a === b) {
    return 0;
  }
  return (a as string) < (b as string) ? -1 : 1;
};

export class BTreeIndex<K = string, V = NodeId> {
  private root: BTreeNode<K, V>;
  private readonly maxKeys: number;

  constructor(
    readonly order = 64,
    readonly compare: Compare<K> = defaultCompare as Compare<K>
  ) {
    if (this.order < 4) {
      throw new Error("btree_order_invalid");
    }
    this.maxKeys = this.order - 1;
    // minKeys calculation reserved for future use in node splitting logic
    // const minKeys = Math.ceil(this.order / 2) - 1;
    this.root = new BTreeNode<K, V>(true);
  }

  insert(key: K, value: V): void {
    if (this.root.keys.length === this.maxKeys) {
      const newRoot = new BTreeNode<K, V>(false);
      newRoot.children.push(this.root);
      this.splitChild(newRoot, 0);
      this.root = newRoot;
    }
    this.insertNonFull(this.root, key, value);
  }

  range(start: K, end: K): V[] {
    const acc: V[] = [];
    this.rangeInternal(this.root, start, end, acc);
    return acc;
  }

  get(key: K): V[] {
    const found = this.search(this.root, key);
    return found ? [...found] : [];
  }

  delete(key: K, value?: V): boolean {
    const all: Array<{ key: K; value: V }> = [];
    this.collectAll(this.root, all);
    let removed = false;
    const filtered: Array<{ key: K; value: V }> = [];
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
    this.root = new BTreeNode<K, V>(true);
    for (const entry of filtered) {
      this.insert(entry.key, entry.value);
    }
    return true;
  }

  private insertNonFull(node: BTreeNode<K, V>, key: K, value: V): void {
    if (node.leaf) {
      let i = node.keys.length - 1;
      while (i >= 0) {
        const k = node.keys[i];
        if (k !== undefined && this.compare(key, k) < 0) {
          i--;
        } else {
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
      } else {
        break;
      }
    }
    idx++;
    if (node.children[idx]?.keys.length === this.maxKeys) {
      this.splitChild(node, idx);
      const k = node.keys[idx];
      if (k !== undefined && this.compare(key, k) > 0) {
        idx++;
      } else if (k !== undefined && this.compare(key, k) === 0) {
        node.values[idx]?.push(value);
        return;
      }
    }
    const child = node.children[idx];
    if (child) {
      this.insertNonFull(child, key, value);
    }
  }

  private splitChild(parent: BTreeNode<K, V>, index: number): void {
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

    const right = new BTreeNode<K, V>(child.leaf);
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

  private rangeInternal(
    node: BTreeNode<K, V>,
    start: K,
    end: K,
    acc: V[]
  ): void {
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
      } else {
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

  private search(node: BTreeNode<K, V>, key: K): V[] | undefined {
    let i = 0;
    while (i < node.keys.length) {
      const k = node.keys[i];
      if (k !== undefined && this.compare(key, k) > 0) {
        i++;
      } else {
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

  private collectAll(node: BTreeNode<K, V>, acc: Array<{ key: K; value: V }>) {
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
