import { describe, expect, test } from "bun:test";
import { ConceptNode } from "../mindscape/nodes/concept-node.tsx";

describe("ConceptNode", () => {
  test("renders", () => {
    // Basic import check to ensure no syntax errors
    expect(ConceptNode).toBeDefined();
  });
});
