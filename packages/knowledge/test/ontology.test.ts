import { describe, expect, it } from "bun:test";

import {
  ANCHORS,
  getOntologyKnowledge,
  getOntologyKnowledgeWithMetadata,
  getSeedConfidence,
  type KnowledgeSourceType,
  PATTERN_ANCHORS,
  RISK_ANCHORS,
  SEED_CONFIDENCE,
  SEED_CONFIDENCE_BY_TYPE,
} from "../src/ontology";

describe("SEED_CONFIDENCE_BY_TYPE", () => {
  it("has correct values per the review recommendations", () => {
    expect(SEED_CONFIDENCE_BY_TYPE.official).toBe(0.8);
    expect(SEED_CONFIDENCE_BY_TYPE.established).toBe(0.7);
    expect(SEED_CONFIDENCE_BY_TYPE.inferred).toBe(0.5);
    expect(SEED_CONFIDENCE_BY_TYPE.community).toBe(0.5);
    expect(SEED_CONFIDENCE_BY_TYPE.preference).toBe(0.4);
  });

  it("official > established > inferred = community > preference", () => {
    expect(SEED_CONFIDENCE_BY_TYPE.official).toBeGreaterThan(
      SEED_CONFIDENCE_BY_TYPE.established
    );
    expect(SEED_CONFIDENCE_BY_TYPE.established).toBeGreaterThan(
      SEED_CONFIDENCE_BY_TYPE.inferred
    );
    expect(SEED_CONFIDENCE_BY_TYPE.inferred).toBe(
      SEED_CONFIDENCE_BY_TYPE.community
    );
    expect(SEED_CONFIDENCE_BY_TYPE.community).toBeGreaterThan(
      SEED_CONFIDENCE_BY_TYPE.preference
    );
  });
});

describe("getSeedConfidence", () => {
  it("returns correct confidence for each source type", () => {
    const types: KnowledgeSourceType[] = [
      "official",
      "established",
      "inferred",
      "community",
      "preference",
    ];

    for (const type of types) {
      expect(getSeedConfidence(type)).toBe(SEED_CONFIDENCE_BY_TYPE[type]);
    }
  });
});

describe("SEED_CONFIDENCE (default)", () => {
  it("equals inferred confidence for backwards compatibility", () => {
    expect(SEED_CONFIDENCE).toBe(SEED_CONFIDENCE_BY_TYPE.inferred);
    expect(SEED_CONFIDENCE).toBe(0.5);
  });
});

describe("getOntologyKnowledge", () => {
  it("returns non-empty list", () => {
    const knowledge = getOntologyKnowledge();
    expect(knowledge.length).toBeGreaterThan(0);
  });

  it("includes all domain anchors", () => {
    const knowledge = getOntologyKnowledge();
    const labels = knowledge
      .filter((k) => k.data._ === "fact")
      .map((k) => (k.data as any).content);

    for (const anchorKey of Object.keys(ANCHORS)) {
      expect(labels).toContain(anchorKey);
    }
  });

  it("includes all risk anchors", () => {
    const knowledge = getOntologyKnowledge();
    const labels = knowledge
      .filter((k) => k.data._ === "fact")
      .map((k) => (k.data as any).content);

    for (const anchor of RISK_ANCHORS) {
      expect(labels).toContain(anchor.label);
    }
  });

  it("includes all pattern anchors", () => {
    const knowledge = getOntologyKnowledge();
    const labels = knowledge
      .filter((k) => k.data._ === "fact")
      .map((k) => (k.data as any).content);

    for (const anchor of PATTERN_ANCHORS) {
      expect(labels).toContain(anchor.label);
    }
  });
});

describe("getOntologyKnowledgeWithMetadata", () => {
  it("returns metadata for each item", () => {
    const knowledge = getOntologyKnowledgeWithMetadata();

    for (const item of knowledge) {
      expect(item.sourceType).toBeDefined();
      expect(item.confidence).toBeDefined();
      expect(item.confidence).toBeGreaterThan(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("assigns official confidence to risk anchors", () => {
    const knowledge = getOntologyKnowledgeWithMetadata();
    const riskItems = knowledge.filter(
      (k) =>
        k.data._ === "fact" && (k.data as any).content.startsWith("Concept:")
    );

    for (const item of riskItems) {
      expect(item.sourceType).toBe("official");
      expect(item.confidence).toBe(SEED_CONFIDENCE_BY_TYPE.official);
    }
  });

  it("assigns inferred confidence to pattern anchors", () => {
    const knowledge = getOntologyKnowledgeWithMetadata();
    const patternItems = knowledge.filter(
      (k) =>
        k.data._ === "fact" && (k.data as any).content.startsWith("Pattern:")
    );

    for (const item of patternItems) {
      expect(item.sourceType).toBe("inferred");
      expect(item.confidence).toBe(SEED_CONFIDENCE_BY_TYPE.inferred);
    }
  });

  it("assigns established confidence to domain anchors", () => {
    const knowledge = getOntologyKnowledgeWithMetadata();
    const domainAnchors = Object.keys(ANCHORS);

    for (const anchor of domainAnchors) {
      const item = knowledge.find(
        (k) => k.data._ === "fact" && (k.data as any).content === anchor
      );

      if (item) {
        expect(item.sourceType).toBe("established");
        expect(item.confidence).toBe(SEED_CONFIDENCE_BY_TYPE.established);
      }
    }
  });

  it("has community confidence for specific tech", () => {
    const knowledge = getOntologyKnowledgeWithMetadata();

    // React, TypeScript, Docker etc. should be community
    const communityTech = ["React", "TypeScript", "Docker", "Rust"];

    for (const tech of communityTech) {
      const items = knowledge.filter(
        (k) => k.data._ === "fact" && (k.data as any).content === tech
      );

      for (const item of items) {
        expect(item.confidence).toBe(SEED_CONFIDENCE_BY_TYPE.community);
      }
    }
  });
});

describe("confidence ordering for override behavior", () => {
  it("allows learned knowledge (0.9) to override all seed types", () => {
    const learnedConfidence = 0.9;

    for (const type of Object.keys(
      SEED_CONFIDENCE_BY_TYPE
    ) as KnowledgeSourceType[]) {
      expect(learnedConfidence).toBeGreaterThan(SEED_CONFIDENCE_BY_TYPE[type]);
    }
  });

  it("official seeds require higher learned confidence to override", () => {
    const overrideThreshold = 0.8;
    // Official confidence (0.8) equals the override threshold
    // This means learned knowledge needs to be > 0.8 to override official seeds
    expect(SEED_CONFIDENCE_BY_TYPE.official).toBe(overrideThreshold);
  });

  it("preference seeds are easily overridden", () => {
    // Any learned knowledge above 0.4 can override preference seeds
    expect(SEED_CONFIDENCE_BY_TYPE.preference).toBe(0.4);
    expect(SEED_CONFIDENCE_BY_TYPE.preference).toBeLessThan(0.5);
  });
});
