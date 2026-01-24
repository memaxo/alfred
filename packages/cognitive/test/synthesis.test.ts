import type {
  KnowledgeConfidence,
  KnowledgeFact,
} from "@alfred/type/knowledge";

import { EMBEDDING_DIM } from "@alfred/embed";
import { empty, fact as graphFact } from "@alfred/knowledge";
import { describe, expect, it, mock } from "bun:test";

const toConfidence = (value: number) => value as KnowledgeConfidence;

const makeEmbedArray = (value: number): number[] =>
  Array.from({ length: EMBEDDING_DIM }, (_, index) =>
    index === 0 ? value : 0
  );

const makeGraphEmbedding = (value: number): Float32Array => {
  const vector = new Float32Array(EMBEDDING_DIM);
  vector[0] = value;
  return vector;
};

const makeFactInput = (
  id: string,
  content: string,
  tags?: string[]
): KnowledgeFact => ({
  id,
  content,
  confidence: toConfidence(0.85),
  timestamp: new Date().toISOString(),
  tags,
});

const embedMock = mock(async () => makeEmbedArray(0));

mock.module("@alfred/rag", () => ({
  embed: embedMock,
}));

const { synthesize } = await import("../src/flows");

describe("synthesize", () => {
  it("detects contradictions between new and existing facts", async () => {
    embedMock.mockReset();
    embedMock.mockImplementation(async () => makeEmbedArray(0));

    const graph = empty();
    const existingId = graph.add(graphFact("Server is online.", 0.9, "seed"));

    const facts = [makeFactInput("fact-1", "Server is not online.")];

    const result = await synthesize(facts, graph);

    expect(result.contradictions).toHaveLength(1);
    const contradiction = result.contradictions[0];
    expect(contradiction.newFact).toBe("fact-1");
    expect(contradiction.existingFact).toBe(existingId);
  });

  it("creates semantic relations when embeddings are similar", async () => {
    embedMock.mockReset();
    embedMock.mockImplementation(async () => makeEmbedArray(1));

    const graph = empty();
    const existingId = graph.add(
      graphFact("Alpha project builds TypeScript runtime.", 0.9, "seed")
    );
    graph.setEmbedding(existingId, makeGraphEmbedding(1));

    const facts = [
      makeFactInput("semantic-1", "Alpha project relies on TypeScript."),
    ];

    const result = await synthesize(facts, graph);

    expect(
      result.relations.some(
        (relation) =>
          relation.kind === "semantically_similar" && relation.to === existingId
      )
    ).toBe(true);
  });

  it("generates insights from fact clusters that share an entity", async () => {
    embedMock.mockReset();
    embedMock.mockImplementation(async () => makeEmbedArray(0));

    const graph = empty();
    const facts = [
      makeFactInput("insight-1", "Orion team shipped the planning dashboard.", [
        "Orion",
      ]),
      makeFactInput("insight-2", "Orion reduced latency by twenty percent.", [
        "Orion",
      ]),
      makeFactInput(
        "insight-3",
        "Orion onboarded three engineers this quarter.",
        ["Orion"]
      ),
    ];

    const result = await synthesize(facts, graph);

    expect(result.insights).toHaveLength(1);
    const [insight] = result.insights;
    expect(insight.conclusion).toContain("Orion");
    expect(insight.derived).toEqual(
      expect.arrayContaining(["insight-1", "insight-2", "insight-3"])
    );
  });
});
