import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { MindscapeCanvas } from "./canvas";

describe("MindscapeCanvas", () => {
  it("should render canvas with ReactFlowProvider", () => {
    render(
      <ReactFlowProvider>
        <MindscapeCanvas />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/knowledge graph/i)).toBeInTheDocument();
  });

  it("should render search input", () => {
    render(
      <ReactFlowProvider>
        <MindscapeCanvas />
      </ReactFlowProvider>
    );

    expect(screen.getByPlaceholderText(/search entities/i)).toBeInTheDocument();
  });

  it("should render stats panel", () => {
    render(
      <ReactFlowProvider>
        <MindscapeCanvas />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/entities/i)).toBeInTheDocument();
    expect(screen.getByText(/relations/i)).toBeInTheDocument();
  });
});
