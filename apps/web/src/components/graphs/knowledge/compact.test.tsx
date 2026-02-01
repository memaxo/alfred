/**
 * Test suite for CompactKnowledgeGraph component
 */

import "@/test/dom";
import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { CompactKnowledgeGraph } from "./compact";

describe("CompactKnowledgeGraph", () => {
  it("renders empty state when no nodes provided", () => {
    const { queryByText } = render(
      <CompactKnowledgeGraph data={{ nodes: [], edges: [] }} />
    );

    const text = queryByText("No knowledge graph data");
    expect(text).toBeTruthy();
  });

  it("renders graph with nodes and edges", () => {
    const data = {
      nodes: [
        {
          id: "1",
          label: "ALFRED",
          type: "concept",
          relevance: 1,
        },
        {
          id: "2",
          label: "TypeScript",
          type: "concept",
          relevance: 0.8,
        },
      ],
      edges: [
        {
          id: "e1-2",
          source: "1",
          target: "2",
          type: "uses",
          weight: 1,
        },
      ],
    };

    const { container } = render(<CompactKnowledgeGraph data={data} />);

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("filters edges to only include visible nodes", () => {
    const data = {
      nodes: [
        {
          id: "1",
          label: "Node 1",
          type: "concept",
          relevance: 1,
        },
      ],
      edges: [
        {
          id: "e1-2",
          source: "1",
          target: "2",
          type: "relates_to",
          weight: 1,
        },
        {
          id: "e1-3",
          source: "1",
          target: "3",
          type: "relates_to",
          weight: 1,
        },
      ],
    };

    const { container } = render(<CompactKnowledgeGraph data={data} />);

    const lines = container.querySelectorAll("line");
    expect(lines.length).toBe(0);
  });
});
