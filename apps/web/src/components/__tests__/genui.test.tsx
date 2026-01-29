import "@/test/dom";
import type { UIMessage as AssistantUIMessage } from "@alfred/type/stream";

import { validateUIDataPart } from "@alfred/type/genui.zod";
import { clearRegistry, registerComponent } from "@alfred/ui/genui";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";

import { renderPart } from "../chat-render";

describe("GenUI chat rendering", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("renders a data-ui part via UISchemaRenderer", () => {
    registerComponent("task", ({ title }: { title: string }) => (
      <div>Task title: {title}</div>
    ));

    const part = {
      type: "data-ui",
      ui: {
        component: "task",
        props: { title: "Ship GenUI" },
      },
    } as const;

    const validation = validateUIDataPart(part);
    expect(validation.valid).toBe(true);

    const message: AssistantUIMessage = {
      id: "m1",
      role: "assistant",
      parts: [part as unknown as AssistantUIMessage["parts"][number]],
      metadata: { status: "sent" },
    };

    const node = renderPart(
      part as unknown as AssistantUIMessage["parts"][number],
      message
    );

    const { getByText } = render(<div>{node}</div>);
    expect(getByText("Task title: Ship GenUI")).toBeTruthy();
  });

  it("renders an unknown component placeholder for data-ui parts", () => {
    const part = {
      type: "data-ui",
      ui: {
        component: "unknown",
        props: { foo: "bar" },
      },
    } as const;

    const validation = validateUIDataPart(part);
    expect(validation.valid).toBe(true);

    const message: AssistantUIMessage = {
      id: "m-unknown",
      role: "assistant",
      parts: [part as unknown as AssistantUIMessage["parts"][number]],
      metadata: { status: "sent" },
    };

    const node = renderPart(
      part as unknown as AssistantUIMessage["parts"][number],
      message
    );

    const { getByText } = render(<div>{node}</div>);
    expect(getByText(/unknown component/i)).toBeTruthy();
  });

  it("returns null for malformed data-ui parts (no crash)", () => {
    const part = {
      type: "data-ui",
      ui: {
        props: { title: "missing component name" },
      },
    } as const;

    const message: AssistantUIMessage = {
      id: "m-invalid",
      role: "assistant",
      parts: [part as unknown as AssistantUIMessage["parts"][number]],
      metadata: { status: "sent" },
    };

    const node = renderPart(
      part as unknown as AssistantUIMessage["parts"][number],
      message
    );

    expect(node).toBeNull();
  });

  it("renders GenUIErrorBoundary fallback when a component throws", () => {
    registerComponent("boom", () => {
      throw new Error("boom");
    });

    const part = {
      type: "data-ui",
      ui: {
        component: "boom",
        props: {},
      },
    } as const;

    const validation = validateUIDataPart(part);
    expect(validation.valid).toBe(true);

    const message: AssistantUIMessage = {
      id: "m-boom",
      role: "assistant",
      parts: [part as unknown as AssistantUIMessage["parts"][number]],
      metadata: { status: "sent" },
    };

    const node = renderPart(
      part as unknown as AssistantUIMessage["parts"][number],
      message
    );

    const { getByText } = render(<div>{node}</div>);
    expect(getByText("Component render failed")).toBeTruthy();
  });

  it("renders a GenUIToolResult returned in a tool-result output", () => {
    registerComponent("task", ({ title }: { title: string }) => (
      <div>Rendered tool UI: {title}</div>
    ));

    const message: AssistantUIMessage = {
      id: "m2",
      role: "assistant",
      parts: [
        {
          type: "tool-result",
          toolCallId: "tc1",
          toolName: "example",
          output: {
            ui: { component: "task", props: { title: "Tool output" } },
            data: { ok: true },
          },
        } as unknown as AssistantUIMessage["parts"][number],
      ],
      metadata: { status: "sent" },
    };

    const part = message.parts[0];
    const node = renderPart(part, message);

    const { getByText } = render(<div>{node}</div>);
    expect(getByText("Rendered tool UI: Tool output")).toBeTruthy();
  });

  it("renders nested GenUI components", () => {
    registerComponent(
      "container",
      ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="container">{children}</div>
      )
    );
    registerComponent("item", ({ label }: { label: string }) => (
      <span data-testid="item">{label}</span>
    ));

    const part = {
      type: "data-ui",
      ui: {
        component: "container",
        props: {},
        children: [
          { component: "item", props: { label: "First" } },
          { component: "item", props: { label: "Second" } },
        ],
      },
    } as const;

    const message: AssistantUIMessage = {
      id: "m-nested",
      role: "assistant",
      parts: [part as unknown as AssistantUIMessage["parts"][number]],
      metadata: { status: "sent" },
    };

    const node = renderPart(
      part as unknown as AssistantUIMessage["parts"][number],
      message
    );

    const { getByText, getAllByTestId } = render(<div>{node}</div>);
    expect(getByText("First")).toBeTruthy();
    expect(getByText("Second")).toBeTruthy();
    expect(getAllByTestId("item")).toHaveLength(2);
  });

  it("handles tool-result with non-GenUI output gracefully", () => {
    const message: AssistantUIMessage = {
      id: "m-plain",
      role: "assistant",
      parts: [
        {
          type: "tool-result",
          toolCallId: "tc2",
          toolName: "calculator",
          output: { result: 42 }, // Plain data, not GenUIToolResult
        } as unknown as AssistantUIMessage["parts"][number],
      ],
      metadata: { status: "sent" },
    };

    const part = message.parts[0];
    const node = renderPart(part, message);

    // Should render the tool name and status, not crash
    const { container } = render(<div>{node}</div>);
    // Default tool-result rendering shows tool name
    expect(container.textContent).toContain("calculator");
  });

  it("validates data-ui part schema before rendering", () => {
    const validPart = {
      type: "data-ui",
      ui: { component: "test", props: { a: 1 } },
    };
    const invalidPart = {
      type: "data-ui",
      ui: { component: "", props: {} }, // Empty component name
    };

    const validResult = validateUIDataPart(validPart);
    const invalidResult = validateUIDataPart(invalidPart);

    expect(validResult.valid).toBe(true);
    expect(invalidResult.valid).toBe(false);
  });
});
