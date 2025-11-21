import { describe, expect, test } from "bun:test";

import { BTreeIndex } from "../src/indices/btree.js";
import type { NodeId } from "../src/hypergraph.js";

const node = (value: string): NodeId => value as NodeId;

describe("BTreeIndex", () => {
  test("supports ordered range queries", () => {
    const tree = new BTreeIndex<string, NodeId>(8);
    tree.insert("alpha", node("a"));
    tree.insert("delta", node("d"));
    tree.insert("beta", node("b"));

    const hits = tree.range("a", "c");
    expect(hits).toEqual([node("a"), node("b")]);
  });

  test("stores duplicate keys", () => {
    const tree = new BTreeIndex<string, NodeId>(6);
    tree.insert("note", node("n1"));
    tree.insert("note", node("n2"));
    expect(tree.get("note").sort()).toEqual([node("n1"), node("n2")].sort());
  });

  test("delete removes keys", () => {
    const tree = new BTreeIndex<string, NodeId>(6);
    tree.insert("gamma", node("g1"));
    tree.insert("gamma", node("g2"));
    tree.insert("omega", node("o"));

    expect(tree.delete("gamma")).toBe(true);
    expect(tree.get("gamma")).toEqual([]);
    expect(tree.range("a", "z")).toEqual([node("o")]);
  });
});
