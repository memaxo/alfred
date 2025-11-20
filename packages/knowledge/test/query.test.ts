import { describe, expect, it } from "bun:test";

import { empty, fact, relation } from "../src/hypergraph";
import { builder, execute, parse, semanticQuery } from "../src/query";

describe("execute", () => {
  it("finds related nodes via relation clauses", () => {
    const graph = empty();
    const alpha = graph.add(fact("Alpha", 0.9, "src"));
    const beta = graph.add(fact("Beta", 0.8, "src"));
    graph.add(relation(alpha, beta, "relates_to"));

    const query = parse("find ?a, ?b where relates_to(?a, ?b)");
    const results = execute(query, graph);

    expect(results).toHaveLength(1);
    const binding = results[0];
    expect(binding.get(query.find[0])).toBe(String(alpha));
    expect(binding.get(query.find[1])).toBe(String(beta));
  });

  it("applies filter clauses using fact confidence", () => {
    const graph = empty();
    const strong = graph.add(fact("Strong", 0.95, "src"));
    graph.add(fact("Weak", 0.5, "src"));

    const query = builder.confident(0.8);
    const results = execute(query, graph);

    expect(results).toHaveLength(1);
    expect(results[0].get(query.find[0])).toBe(String(strong));
  });

  it("invalidates cache when graph version changes", () => {
    const graph = empty();
    const alpha = graph.add(fact("Alpha", 0.9, "src"));
    const beta = graph.add(fact("Beta", 0.8, "src"));
    const gamma = graph.add(fact("Gamma", 0.7, "src"));
    graph.add(relation(alpha, beta, "relates_to"));

    const query = builder.related(String(alpha), "relates_to");
    const first = execute(query, graph);
    expect(first).toHaveLength(1);

    graph.add(relation(alpha, gamma, "relates_to"));
    const second = execute(query, graph);
    expect(second).toHaveLength(2);
  });
});

describe("semanticQuery", () => {
  it("returns nodes whose content matches query terms", () => {
    const graph = empty();
    const alpha = graph.add(fact("Launch alpha build", 0.9, "log"));
    graph.add(fact("Review beta plan", 0.6, "log"));

    const results = semanticQuery("alpha build", graph, 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toBe(alpha);
  });

  it("prefers embedding KNN results when available", () => {
    const graph = empty();
    const alpha = graph.add(fact("Alpha", 0.9, "src"));
    const beta = graph.add(fact("Beta", 0.9, "src"));

    graph.setEmbedding(alpha, new Float32Array([1, 0]));
    graph.setEmbedding(beta, new Float32Array([0, 1]));

    const results = semanticQuery("unused", graph, 1, {
      embedding: new Float32Array([0.99, 0.01]),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(alpha);
  });
});
