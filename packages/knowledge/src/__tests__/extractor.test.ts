import { describe, expect, test } from "bun:test";
import type { KnowledgeEntry } from "../extractor";
import {
  detectContradiction,
  extract,
  extractEntities,
  extractRelations,
  extractTemporal,
  toKnowledge,
} from "../extractor";
import type { Knowledge } from "../hypergraph";

type RelationEntry = KnowledgeEntry & {
  data: Extract<Knowledge, { _: "relation" }>;
};

const isRelationEntry = (entry: KnowledgeEntry): entry is RelationEntry =>
  entry.data._ === "relation";

describe("extractEntities", () => {
  test("detects people, organizations, and places", () => {
    const text =
      "Elon Musk founded SpaceX in Hawthorne, California with support from NASA.";
    const entities = extractEntities(text);
    const labels = entities.map((entity) => entity.label);

    expect(labels).toContain("Elon Musk");
    expect(labels).toContain("SpaceX");
    expect(labels.some((label) => label.includes("Hawthorne"))).toBe(true);

    const elon = entities.find((entity) => entity.label === "Elon Musk");
    expect(elon?.kind).toBe("person");
    const spacex = entities.find((entity) => entity.label === "SpaceX");
    expect(spacex?.kind).toBe("organization");
  });
});

describe("extractRelations", () => {
  test("derives subject-verb-object relations", () => {
    const text = "John works at Microsoft and leads Azure.";
    const entities = extractEntities(text);
    const relations = extractRelations(text, entities);

    expect(relations.length).toBeGreaterThanOrEqual(2);
    expect(
      relations.some(
        (relation) =>
          relation.source === "John" &&
          relation.relation === "work" &&
          relation.target === "Microsoft"
      )
    ).toBe(true);
    expect(
      relations.some(
        (relation) =>
          relation.source === "John" &&
          relation.relation === "lead" &&
          relation.target === "Azure"
      )
    ).toBe(true);
  });
});

describe("detectContradiction", () => {
  test("detects explicit negation", () => {
    const contradiction = detectContradiction(
      "The launch is safe.",
      "The launch is not safe."
    );

    expect(contradiction).not.toBeNull();
    expect(contradiction?.reason).toBe("negation");
  });

  test("detects antonym-based contradiction", () => {
    const contradiction = detectContradiction(
      "The forecast is bright.",
      "The forecast is dark."
    );

    expect(contradiction).not.toBeNull();
    expect(contradiction?.reason).toBe("antonym");
  });
});

describe("extractTemporal", () => {
  test("captures absolute dates and recurring intervals", () => {
    const text =
      "Kickoff is on January 15, 2024 at 3pm, and the team meets every Monday morning.";
    const temporal = extractTemporal(text);

    expect(temporal.length).toBeGreaterThanOrEqual(2);
    expect(
      temporal.some(
        (expr) =>
          expr.type === "instant" &&
          expr.normalized.start?.startsWith("2024-01-15")
      )
    ).toBe(true);
    expect(
      temporal.some(
        (expr) =>
          expr.type === "recurring" && expr.recurrence?.includes("monday")
      )
    ).toBe(true);
  });
});

describe("toKnowledge", () => {
  test("emits relation edges between extracted entities", () => {
    const extraction = extract("Elon Musk founded SpaceX in 2002.", "unit");
    const knowledge = toKnowledge(extraction);

    const relationEntry = knowledge.find(isRelationEntry);
    expect(relationEntry).toBeDefined();
    expect(typeof relationEntry?.data.from).toBe("string");
    expect(typeof relationEntry?.data.to).toBe("string");

    const entityFacts = knowledge.filter(
      (entry) =>
        entry.data._ === "fact" && entry.data.content.startsWith("[entity:")
    );
    expect(entityFacts.length).toBeGreaterThanOrEqual(2);
  });
});
