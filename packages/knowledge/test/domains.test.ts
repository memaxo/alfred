import { beforeEach, describe, expect, it } from "bun:test";

import {
  classifyDomain,
  classifyDomainWithLearning,
  clearDomainCache,
  type DomainResult,
  getDomainCacheStats,
  LEARNED_OVERRIDE_THRESHOLD,
  updateDomainCache,
} from "../src/lexicon/domains";

describe("classifyDomain (sync)", () => {
  beforeEach(() => {
    clearDomainCache();
  });

  it("returns static results for Coding domain keywords", () => {
    const results = classifyDomain("Write some JavaScript code");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toBe("Coding");
    expect(results[0].source).toBe("static");
    expect(results[0].confidence).toBe(0.5);
  });

  it("returns static results for Security domain keywords", () => {
    const results = classifyDomain(
      "This is about security vulnerabilities and encryption"
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toBe("Security");
    expect(results[0].source).toBe("static");
  });

  it("returns static results for AI domain keywords", () => {
    const results = classifyDomain(
      "Train a machine learning model using transformers"
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toBe("AI");
    expect(results[0].source).toBe("static");
  });

  it("returns empty array for text with no domain keywords", () => {
    const results = classifyDomain("Hello world");

    expect(results).toEqual([]);
  });

  it("returns cached results when cache is populated", () => {
    const cachedDomains: DomainResult[] = [
      { domain: "CustomDomain", confidence: 0.9, source: "learned" },
    ];

    updateDomainCache("specific test text", cachedDomains);
    const results = classifyDomain("specific test text");

    expect(results).toEqual(cachedDomains);
  });

  it("performance: completes in under 1ms", () => {
    const start = performance.now();

    // Run multiple times to get a reliable measurement
    for (let i = 0; i < 100; i++) {
      classifyDomain("Write JavaScript code for machine learning");
    }

    const duration = (performance.now() - start) / 100;
    expect(duration).toBeLessThan(1); // <1ms per call
  });
});

describe("classifyDomainWithLearning (async)", () => {
  beforeEach(() => {
    clearDomainCache();
  });

  it("returns static results when no findAssociations provided", async () => {
    const results = await classifyDomainWithLearning(
      "Write some JavaScript code"
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toBe("Coding");
    expect(results[0].source).toBe("static");
  });

  it("returns learned results when findAssociations returns data", async () => {
    const mockFindAssociations = async (): Promise<DomainResult[]> => [
      { domain: "CustomDomain", confidence: 0.85, source: "learned" },
    ];

    const results = await classifyDomainWithLearning(
      "some text",
      "user",
      mockFindAssociations
    );

    expect(results.length).toBe(1);
    expect(results[0].domain).toBe("CustomDomain");
    expect(results[0].source).toBe("learned");
  });

  it("uses cached results on subsequent calls", async () => {
    let callCount = 0;
    const mockFindAssociations = async (): Promise<DomainResult[]> => {
      callCount++;
      return [{ domain: "LearnedDomain", confidence: 0.85, source: "learned" }];
    };

    // First call - should hit findAssociations
    await classifyDomainWithLearning("same text", "user", mockFindAssociations);
    expect(callCount).toBe(1);

    // Second call - should use cache
    await classifyDomainWithLearning("same text", "user", mockFindAssociations);
    expect(callCount).toBe(1); // Still 1, didn't call again
  });

  it("falls back to static when findAssociations returns empty", async () => {
    const mockFindAssociations = async (): Promise<DomainResult[]> => [];

    const results = await classifyDomainWithLearning(
      "Write JavaScript code",
      "user",
      mockFindAssociations
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toBe("Coding");
    expect(results[0].source).toBe("static");
  });

  it("falls back to static when findAssociations throws", async () => {
    const mockFindAssociations = async (): Promise<DomainResult[]> => {
      throw new Error("Graph query failed");
    };

    const results = await classifyDomainWithLearning(
      "Write JavaScript code",
      "user",
      mockFindAssociations
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toBe("Coding");
    expect(results[0].source).toBe("static");
  });
});

describe("LEARNED_OVERRIDE_THRESHOLD", () => {
  beforeEach(() => {
    clearDomainCache();
  });

  it("is set to 0.8", () => {
    expect(LEARNED_OVERRIDE_THRESHOLD).toBe(0.8);
  });

  it("uses ONLY high-confidence learned results when above threshold", async () => {
    const mockFindAssociations = async (): Promise<DomainResult[]> => [
      { domain: "HighConfidence", confidence: 0.9, source: "learned" },
      { domain: "LowConfidence", confidence: 0.6, source: "seed" },
    ];

    const results = await classifyDomainWithLearning(
      "test text",
      "user",
      mockFindAssociations
    );

    expect(results.length).toBe(1);
    expect(results[0].domain).toBe("HighConfidence");
    expect(results[0].confidence).toBe(0.9);
  });

  it("returns all learned results when none exceed threshold", async () => {
    const mockFindAssociations = async (): Promise<DomainResult[]> => [
      { domain: "Domain1", confidence: 0.7, source: "learned" },
      { domain: "Domain2", confidence: 0.6, source: "seed" },
    ];

    const results = await classifyDomainWithLearning(
      "test text",
      "user",
      mockFindAssociations
    );

    expect(results.length).toBe(2);
  });

  it("excludes seed sources from override threshold check", async () => {
    const mockFindAssociations = async (): Promise<DomainResult[]> => [
      { domain: "SeedDomain", confidence: 0.9, source: "seed" }, // High but seed
      { domain: "LearnedDomain", confidence: 0.7, source: "learned" }, // Lower but learned
    ];

    const results = await classifyDomainWithLearning(
      "test text",
      "user",
      mockFindAssociations
    );

    // Should NOT use only high-confidence because SeedDomain is source="seed"
    expect(results.length).toBe(2);
  });
});

describe("domain cache", () => {
  beforeEach(() => {
    clearDomainCache();
  });

  it("starts empty", () => {
    const stats = getDomainCacheStats();
    expect(stats.size).toBe(0);
  });

  it("reports correct size after updates", () => {
    updateDomainCache("text1", [
      { domain: "A", confidence: 0.8, source: "learned" },
    ]);
    updateDomainCache("text2", [
      { domain: "B", confidence: 0.8, source: "learned" },
    ]);

    const stats = getDomainCacheStats();
    expect(stats.size).toBe(2);
  });

  it("clears properly", () => {
    updateDomainCache("text", [
      { domain: "A", confidence: 0.8, source: "learned" },
    ]);
    expect(getDomainCacheStats().size).toBe(1);

    clearDomainCache();
    expect(getDomainCacheStats().size).toBe(0);
  });

  it("normalizes cache keys (case insensitive)", () => {
    updateDomainCache("TEST TEXT", [
      { domain: "A", confidence: 0.8, source: "learned" },
    ]);

    const results = classifyDomain("test text"); // Different case
    expect(results[0].domain).toBe("A");
  });
});

describe("cold start behavior", () => {
  beforeEach(() => {
    clearDomainCache();
  });

  it("returns same results as pre-migration static classification", () => {
    // These should match the original classifyDomain behavior before the migration
    const codingText = "Write a function in TypeScript";
    const results = classifyDomain(codingText);

    expect(results.some((r) => r.domain === "Coding")).toBe(true);
  });

  it("multiple domains can be detected", () => {
    const text =
      "Build a machine learning model for cybersecurity threat detection";
    const results = classifyDomain(text);

    const domains = results.map((r) => r.domain);
    // Should detect both AI and Security
    expect(domains).toContain("AI");
    expect(domains).toContain("Security");
  });

  it("boosts Coding for programming language mentions in context", () => {
    // Programming languages detected via isProgrammingLanguage() boost Coding
    // Note: isProgrammingLanguage checks exact match, not substring
    const results = classifyDomain("typescript development build deploy");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toBe("Coding");
  });
});
