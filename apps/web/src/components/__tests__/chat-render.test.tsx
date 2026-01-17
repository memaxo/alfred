import "@/test/dom";
import { describe, expect, it, vi } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { renderAssistantPart } from "@/components/chat-render";

describe("chat-render tool approval UI", () => {
  it("renders approval confirmation only for approval-requested tool invocations", () => {
    const onAddToolApprovalResponse = vi.fn();

    const part = {
      type: "tool-test",
      toolCallId: "call-1",
      state: "approval-requested",
      input: { ok: true },
      approval: { id: "approval-1" },
    };

    const message = {
      id: "msg-1",
      role: "assistant",
      parts: [part],
    };

    const node = renderAssistantPart(part as any, message as any, {
      onAddToolApprovalResponse,
    });

    const view = render(<div>{node}</div>);

    expect(view.getByText("Approve: test")).toBeTruthy();
    expect(view.getByText("Cancel")).toBeTruthy();
    expect(view.getByText("Confirm with Passkey")).toBeTruthy();

    fireEvent.click(view.getByText("Confirm with Passkey"));
    expect(onAddToolApprovalResponse).toHaveBeenCalledWith({
      id: "approval-1",
      approved: true,
    });

    fireEvent.click(view.getByText("Cancel"));
    expect(onAddToolApprovalResponse).toHaveBeenCalledWith({
      id: "approval-1",
      approved: false,
    });
  });

  it("does not render approval controls when state is running", () => {
    const onAddToolApprovalResponse = vi.fn();

    const part = {
      type: "tool-test",
      toolCallId: "call-1",
      state: "input-available",
      input: { ok: true },
    };

    const message = {
      id: "msg-1",
      role: "assistant",
      parts: [part],
    };

    const node = renderAssistantPart(part as any, message as any, {
      onAddToolApprovalResponse,
    });

    const view = render(<div>{node}</div>);

    expect(view.queryByText("Approve: test")).toBeNull();
    expect(view.queryByText("Cancel")).toBeNull();
    expect(view.queryByText("Confirm with Passkey")).toBeNull();
  });
});
