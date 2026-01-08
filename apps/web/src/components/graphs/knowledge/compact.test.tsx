/**
 * Test suite for CompactKnowledgeGraph component
 */

import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { CompactKnowledgeGraph } from "./compact";

describe("CompactKnowledgeGraph", () => {
  it("renders empty state when no nodes provided", () => {
    render(<CompactKnowledgeGraph data={{ nodes: [], edges: [] }} />);

    const text = screen.queryByText("No knowledge graph data");
    expect(text).toBeTruthy();
  });

  it("renders graph with nodes and edges", () => {
    const data = {
      nodes: [
        {
          id: "1",
          label: "ALFRED",
          type: "concept",
          relevance: 1.0,
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

    render(<CompactKnowledgeGraph data={data} />);

    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("filters edges to only include visible nodes", () => {
    const data = {
      nodes: [
        {
          id: "1",
          label: "Node 1",
          type: "concept",
          relevance: 1.0,
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

    render(<CompactKnowledgeGraph data={data} />);

    const lines = document.querySelectorAll("line");
    expect(lines.length).toBe(0);
  });
});
