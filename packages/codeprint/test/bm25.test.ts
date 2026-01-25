import { describe, expect, it } from "bun:test";

import { BM25Index } from "../src/bm25.js";

describe("BM25Index", () => {
  it("ranks documents by term frequency", () => {
    const index = new BM25Index();

    index.addDocument("file1.ts", "auth auth auth login");
    index.addDocument("file2.ts", "auth user profile");
    index.addDocument("file3.ts", "database query pool");

    const results = index.search("auth", 10);

    expect(results[0]!.path).toBe("file1.ts");
    expect(results[1]!.path).toBe("file2.ts");
    expect(results.length).toBe(2);
  });

  it("weights rare terms higher (IDF)", () => {
    const index = new BM25Index();

    index.addDocument("auth.ts", "AuthProvider function class");
    index.addDocument("utils.ts", "function helper utility");
    index.addDocument("db.ts", "function query database");

    const results = index.search("AuthProvider", 10);

    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe("auth.ts");
    expect(results[0]!.score).toBeGreaterThan(0);
  });

  it("handles camelCase tokenization", () => {
    const index = new BM25Index();

    index.addDocument("auth.ts", "AuthProvider loginUser");

    const results = index.search("auth provider login", 10);

    expect(results[0]!.matchedTerms).toContain("auth");
    expect(results[0]!.matchedTerms).toContain("provider");
    expect(results[0]!.matchedTerms).toContain("login");
  });

  it("removes documents correctly", () => {
    const index = new BM25Index();

    index.addDocument("a.ts", "auth login");
    index.addDocument("b.ts", "auth logout");

    expect(index.size).toBe(2);

    index.removeDocument("a.ts");

    expect(index.size).toBe(1);
    const results = index.search("login", 10);
    expect(results.length).toBe(0);
  });

  it("returns empty for no matches", () => {
    const index = new BM25Index();
    index.addDocument("auth.ts", "login logout");

    const results = index.search("database", 10);
    expect(results).toEqual([]);
  });
});
