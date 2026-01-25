import { describe, expect, test } from "bun:test";

import { extract } from "../extractor";
import {
  applyTopicBoost,
  classifyDomain,
  clearDomainCache,
  detectTopics,
  type TopicResult,
} from "../lexicon/domains";

describe("detectTopics", () => {
  test("detects Coding domain from programming keywords", () => {
    const result = detectTopics("I prefer using Bun over Node for my servers.");

    expect(result.topics).toContain("Coding");
    expect(result.primaryDomain).toBe("Coding");
    expect(result.confidenceBoost).toBeGreaterThan(1);
  });

  test("detects code blocks with triple backticks", () => {
    const result = detectTopics(`
      Here's how to create a function:
      \`\`\`typescript
      const add = (a: number, b: number) => a + b;
      \`\`\`
    `);

    expect(result.hasCodeBlock).toBe(true);
    expect(result.topics).toContain("Coding");
    expect(result.confidenceBoost).toBeGreaterThan(1.2); // Code block bonus
  });

  test("detects code patterns without explicit code blocks", () => {
    const result = detectTopics(
      "The function uses import React from 'react' to load the component."
    );

    expect(result.hasCodeBlock).toBe(true); // Code pattern detected
    expect(result.topics).toContain("Coding");
  });

  test("detects AI domain from ML keywords", () => {
    const result = detectTopics(
      "The transformer model uses attention for inference on the LLM."
    );

    expect(result.topics).toContain("AI");
  });

  test("detects Security domain from cybersecurity keywords", () => {
    const result = detectTopics(
      "The CVE vulnerability allows SQL injection attacks through the firewall."
    );

    expect(result.topics).toContain("Security");
  });

  test("detects Politics domain", () => {
    const result = detectTopics(
      "The presidential election campaign focuses on healthcare policy legislation."
    );

    expect(result.topics).toContain("Politics");
  });

  test("detects News domain", () => {
    const result = detectTopics(
      "Breaking news from Reuters: the headline was reported by journalists."
    );

    expect(result.topics).toContain("News");
  });

  test("detects Social Media domain", () => {
    const result = detectTopics(
      "The viral tweet from the influencer is trending on Twitter with many followers."
    );

    expect(result.topics).toContain("SocialMedia");
  });

  test("detects Music domain", () => {
    const result = detectTopics(
      "The new album from the artist features rock and electronic tracks on Spotify."
    );

    expect(result.topics).toContain("Music");
  });

  test("detects Movies domain", () => {
    const result = detectTopics(
      "The Oscar-nominated film director premiered the sequel at the Hollywood cinema."
    );

    expect(result.topics).toContain("Movies");
  });

  test("detects multiple domains in mixed content", () => {
    const result = detectTopics(
      "The AI model was deployed using Docker on AWS for the news aggregation app."
    );

    expect(result.topics.length).toBeGreaterThanOrEqual(2);
    expect(result.topics).toContain("AI");
    expect(result.topics).toContain("Coding");
  });

  test("returns empty topics for generic text", () => {
    const result = detectTopics("The weather today is nice and sunny.");

    expect(result.topics.length).toBe(0);
    expect(result.primaryDomain).toBeNull();
    expect(result.confidenceBoost).toBe(1);
  });
});

describe("applyTopicBoost", () => {
  test("boosts confidence for Coding domain", () => {
    const topicResult: TopicResult = {
      topics: ["Coding"],
      hasCodeBlock: false,
      primaryDomain: "Coding",
      confidenceBoost: 1.2,
    };

    const boosted = applyTopicBoost(0.8, topicResult);
    expect(boosted).toBeCloseTo(0.96, 2);
  });

  test("clamps boosted confidence to 1.0 max", () => {
    const topicResult: TopicResult = {
      topics: ["Coding"],
      hasCodeBlock: true,
      primaryDomain: "Coding",
      confidenceBoost: 1.5, // Max boost
    };

    const boosted = applyTopicBoost(0.9, topicResult);
    expect(boosted).toBe(1); // Clamped
  });

  test("no boost for no topics", () => {
    const topicResult: TopicResult = {
      topics: [],
      hasCodeBlock: false,
      primaryDomain: null,
      confidenceBoost: 1,
    };

    const boosted = applyTopicBoost(0.8, topicResult);
    expect(boosted).toBe(0.8);
  });
});

describe("classifyDomain", () => {
  test("returns static classification for coding terms", () => {
    clearDomainCache();
    const results = classifyDomain("Using TypeScript with React for the API");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.domain).toBe("Coding");
    expect(results[0]?.source).toBe("static");
  });

  test("returns multiple domains for mixed content", () => {
    clearDomainCache();
    const results = classifyDomain(
      "Training the ML model with Python for AI inference"
    );

    const domains = results.map((r) => r.domain);
    expect(domains).toContain("Coding");
    expect(domains).toContain("AI");
  });
});

describe("extract with domain detection", () => {
  test("includes topics in extraction result", () => {
    const result = extract(
      "I prefer using Bun over Node for my servers because it's faster.",
      "test"
    );

    expect(result.topics).toContain("Coding");
    expect(result.primaryDomain).toBe("Coding");
    expect(result.hasCodeBlock).toBe(false);
  });

  test("boosts confidence for coding content", () => {
    const codingResult = extract(
      "The TypeScript function exports a React component.",
      "test"
    );
    const genericResult = extract(
      "The weather today is nice and sunny outside.",
      "test"
    );

    // Coding content should have higher confidence due to boost
    const codingConfidence = codingResult.facts[0]?.confidence ?? 0;
    const genericConfidence = genericResult.facts[0]?.confidence ?? 0;

    expect(codingConfidence).toBeGreaterThan(genericConfidence);
  });

  test("detects code blocks in extraction", () => {
    const result = extract(
      `Here's a function:
      \`\`\`ts
      export const add = (a: number, b: number) => a + b;
      \`\`\``,
      "test"
    );

    expect(result.hasCodeBlock).toBe(true);
    expect(result.topics).toContain("Coding");
  });

  test("returns empty topics for empty text", () => {
    const result = extract("", "test");

    expect(result.topics).toEqual([]);
    expect(result.primaryDomain).toBeNull();
    expect(result.hasCodeBlock).toBe(false);
  });
});
