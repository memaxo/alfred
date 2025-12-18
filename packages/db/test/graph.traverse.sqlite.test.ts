import { expect, it } from "bun:test";
import { graphRepo } from "@alfred/db";
import { describeSqlite } from "@alfred/db/testing";

const TARGETS = ["Coding", "Security", "Politics", "AI", "News"];

describeSqlite("graphRepo.findNearestConcept sqlite fallback", () => {
  it("returns the closest anchor via BFS", async () => {
    const resource = `sqlite-traverse:${Date.now()}`;
    const seeds = [
      { resource, hash: "concept-coding", kind: "concept", label: "Coding" },
      {
        resource,
        hash: "concept-frontend",
        kind: "concept",
        label: "Frontend",
      },
      { resource, hash: "concept-react", kind: "concept", label: "React" },
      {
        resource,
        hash: "concept-politics",
        kind: "concept",
        label: "Politics",
      },
    ];

    const nodeMap = await graphRepo.upsertNodes(seeds as any);
    const react = nodeMap.get(`${resource}:concept-react`);
    const frontend = nodeMap.get(`${resource}:concept-frontend`);
    const coding = nodeMap.get(`${resource}:concept-coding`);
    const politics = nodeMap.get(`${resource}:concept-politics`);

    expect(react && frontend && coding && politics).toBeTruthy();

    await graphRepo.upsertEdges([
      {
        resource,
        hash: "react-frontend",
        fromId: react?.id,
        toId: frontend?.id,
        kind: "relates_to",
      },
      {
        resource,
        hash: "frontend-coding",
        fromId: frontend?.id,
        toId: coding?.id,
        kind: "relates_to",
      },
      {
        resource,
        hash: "politics-isolated",
        fromId: politics?.id,
        toId: coding?.id,
        kind: "relates_to",
      },
    ] as any);

    const result = await graphRepo.findNearestConcept(
      "React",
      TARGETS,
      3,
      resource
    );

    expect(result).toBeTruthy();
    if (!result) {
      throw new Error("expected result to be defined");
    }
    expect(result.concept).toBe("Coding");
    expect(result.path.length).toBe(3);
    expect(result.path[0]).toBe(react?.id);
    expect(result.path.at(-1)).toBe(coding?.id);
  });

  it("respects the maxDepth guard", async () => {
    const resource = `sqlite-traverse-depth:${Date.now()}`;
    const seeds = [
      { resource, hash: "concept-coding", kind: "concept", label: "Coding" },
      { resource, hash: "concept-mid", kind: "concept", label: "Frontend" },
      { resource, hash: "concept-start", kind: "concept", label: "React" },
    ];

    const nodeMap = await graphRepo.upsertNodes(seeds as any);
    const start = nodeMap.get(`${resource}:concept-start`);
    const mid = nodeMap.get(`${resource}:concept-mid`);
    const target = nodeMap.get(`${resource}:concept-coding`);

    expect(start && mid && target).toBeTruthy();

    await graphRepo.upsertEdges([
      {
        resource,
        hash: "start-mid",
        fromId: start?.id,
        toId: mid?.id,
        kind: "relates_to",
      },
      {
        resource,
        hash: "mid-target",
        fromId: mid?.id,
        toId: target?.id,
        kind: "relates_to",
      },
    ] as any);

    const result = await graphRepo.findNearestConcept(
      "React",
      TARGETS,
      1,
      resource
    );

    expect(result).toBeNull();
  });
});
