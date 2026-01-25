import { beforeAll, describe, expect, it, mock } from "bun:test";

const graphFixture = new Map<
  string,
  { concept: string; path: string[]; depth: number }
>([
  [
    "react",
    { concept: "Coding", path: ["React", "Frontend", "Coding"], depth: 2 },
  ],
  ["python", { concept: "Coding", path: ["Python", "Coding"], depth: 1 }],
  ["kali", { concept: "Security", path: ["Kali", "Security"], depth: 1 }],
  ["transformer", { concept: "AI", path: ["Transformer", "AI"], depth: 1 }],
  ["gpt", { concept: "AI", path: ["GPT", "AI"], depth: 1 }],
  [
    "deepc",
    { concept: "Coding", path: ["DeepC", "DeepD", "Coding"], depth: 2 },
  ],
  ["deepd", { concept: "Coding", path: ["DeepD", "Coding"], depth: 1 }],
  [
    "deepb",
    {
      concept: "Coding",
      path: ["DeepB", "DeepC", "DeepD", "Coding"],
      depth: 3,
    },
  ],
  [
    "deepa",
    {
      concept: "Coding",
      path: ["DeepA", "DeepB", "DeepC", "DeepD", "Coding"],
      depth: 4,
    },
  ],
  [
    "hooks",
    { concept: "Coding", path: ["Hooks", "React", "Coding"], depth: 2 },
  ],
  ["senate", { concept: "Politics", path: ["Senate", "Politics"], depth: 1 }],
  [
    "election",
    { concept: "Politics", path: ["Election", "Politics"], depth: 1 },
  ],
  ["headline", { concept: "News", path: ["Headline", "News"], depth: 1 }],
  ["reuters", { concept: "News", path: ["Reuters", "News"], depth: 1 }],
]);

const findNearestConceptMock = mock(
  (
    label: string | undefined,
    targetConcepts: string[],
    maxDepth = 3
  ): Promise<{
    concept: string;
    path: string[];
    node: { label: string };
  } | null> => {
    if (!label) {
      return Promise.resolve(null);
    }
    const entry = lookupFixtureEntry(label);
    if (!entry) {
      return Promise.resolve(null);
    }
    if (entry.depth > maxDepth) {
      return Promise.resolve(null);
    }
    const normalizedTargets = targetConcepts.map((c) => c.toLowerCase());
    if (!normalizedTargets.includes(entry.concept.toLowerCase())) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      concept: entry.concept,
      path: entry.path,
      node: { label: entry.concept } as { label: string },
    });
  }
);

mock.module("@alfred/db/repo/graph", () => ({
  findNearestConcept: findNearestConceptMock,
}));

const embedManyMock = mock((labels: string[]) =>
  Promise.resolve(labels.map((label) => buildDeterministicVector(label)))
);

mock.module("@alfred/rag", () => ({
  embedMany: embedManyMock,
}));

const { getPersonaInstruction } = await import("../src/assistant/src/adapter");
const { linkEntities } = await import("../src/services/entity-linker");

describe("Emergent Behavior & Entity Linking", () => {
  beforeAll(() => {
    findNearestConceptMock.mockClear();
    embedManyMock.mockClear();
  });

  it("should link 'React' to 'Coding'", async () => {
    const result = await linkEntities([
      { role: "user", content: "I use React." },
    ]);
    expect(result.domains).toContain("Coding");
  });

  it("should link 'Python' to 'Coding'", async () => {
    const result = await linkEntities([
      { role: "user", content: "Python script" },
    ]);
    expect(result.domains).toContain("Coding");
  });

  it("should link 'Python' and 'Kali' to 'Coding' and 'Security'", async () => {
    const result = await linkEntities([
      { role: "user", content: "Using Python on Kali Linux" },
    ]);
    expect(result.domains).toContain("Coding");
    expect(result.domains).toContain("Security");
  });

  it("should return empty for empty input", async () => {
    const result = await linkEntities([{ role: "user", content: "" }]);
    expect(result.domains).toHaveLength(0);
  });

  it("should return empty for irrelevant input", async () => {
    const result = await linkEntities([{ role: "user", content: "xzqwy" }]);
    expect(result.domains).toHaveLength(0);
  });

  it("should NOT find Coding via too-long path (DeepA)", async () => {
    const result = await linkEntities([
      { role: "user", content: "DeepA analysis" },
    ]);
    expect(result.domains).not.toContain("Coding");
  });

  it("should find Coding via valid path depth (DeepC)", async () => {
    const result = await linkEntities([
      { role: "user", content: "DeepC analysis" },
    ]);
    expect(result.domains).toContain("Coding");
  });

  it("should generate persona for Coding", () => {
    const instruction = getPersonaInstruction(["Coding"]);
    expect(instruction).toBeDefined();
    expect(instruction).toContain("Senior Software Engineer");
  });

  it("should generate persona for AI", () => {
    const instruction = getPersonaInstruction(["AI"]);
    expect(instruction).toBeDefined();
    expect(instruction).toContain("AI Research Scientist");
  });

  it("should generate persona for Politics", () => {
    const instruction = getPersonaInstruction(["Politics"]);
    expect(instruction).toBeDefined();
    expect(instruction).toContain("Political Analyst");
  });

  it("should generate persona for News", () => {
    const instruction = getPersonaInstruction(["News"]);
    expect(instruction).toBeDefined();
    expect(instruction).toContain("News Curator");
  });

  it("should merge personas for Coding and Security", () => {
    const instruction = getPersonaInstruction(["Coding", "Security"]);
    expect(instruction).toContain("Senior Software Engineer");
    expect(instruction).toContain("Cybersecurity Researcher");
  });

  it("should return null for unknown domain", () => {
    const instruction = getPersonaInstruction(["UnknownDomain"]);
    expect(instruction).toBeNull();
  });

  it("should complete linking within 500ms (budget)", async () => {
    const start = performance.now();
    await linkEntities([
      { role: "user", content: "React and Python integration" },
    ]);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(500);
  });

  it("should return paths for visualization", async () => {
    const result = await linkEntities([{ role: "user", content: "React" }]);
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.paths[0].length).toBeGreaterThan(1);
  });

  it("should handle lowercase input 'react'", async () => {
    const result = await linkEntities([
      { role: "user", content: "i use react daily" },
    ]);
    expect(result.domains).toContain("Coding");
  });

  it("should handle single capitalized word 'Python'", async () => {
    const result = await linkEntities([{ role: "user", content: "Python" }]);
    expect(result.domains).toContain("Coding");
  });

  it("should ignore common stop words/noise", async () => {
    const result = await linkEntities([
      { role: "user", content: "the a is of" },
    ]);
    expect(result.domains).toHaveLength(0);
  });

  it("should detect multiple entities", async () => {
    const result = await linkEntities([
      { role: "user", content: "React running on Kali" },
    ]);
    expect(result.domains).toContain("Coding");
    expect(result.domains).toContain("Security");
  });

  it("should use context from previous messages", async () => {
    const messages = [
      { role: "user", content: "React" },
      { role: "assistant", content: "Ok" },
      { role: "user", content: "hooks" },
    ];
    const result = await linkEntities(messages);
    expect(result.domains).toContain("Coding");
  });

  it("skips embeddings for obvious anchors", async () => {
    embedManyMock.mockClear();
    await linkEntities([{ role: "user", content: "React" }]);
    expect(embedManyMock).not.toHaveBeenCalled();
  });

  it("should handle no user messages", async () => {
    const result = await linkEntities([{ role: "system", content: "hi" }]);
    expect(result.domains).toHaveLength(0);
  });

  it("should generate deterministic instruction regardless of input order", () => {
    const i1 = getPersonaInstruction(["Coding", "Security"]);
    const i2 = getPersonaInstruction(["Security", "Coding"]);
    expect(i1).toBe(i2);
  });

  it("should return null instruction for empty domains", () => {
    expect(getPersonaInstruction([])).toBeNull();
  });
});

function buildDeterministicVector(label: string): number[] {
  const base =
    [...label.toLowerCase()].reduce(
      (acc, char) => acc + char.codePointAt(0),
      0
    ) % 97;
  return Array.from({ length: 8 }, (_, idx) => ((base + idx * 13) % 101) / 100);
}

function lookupFixtureEntry(label: string | undefined) {
  if (!label) {
    return;
  }
  const normalized = normalizeLabel(label);
  if (!normalized) {
    return;
  }
  const direct = graphFixture.get(normalized);
  if (direct) {
    return direct;
  }
  for (const [key, entry] of graphFixture.entries()) {
    if (normalized.includes(key)) {
      return entry;
    }
  }
  return;
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}
