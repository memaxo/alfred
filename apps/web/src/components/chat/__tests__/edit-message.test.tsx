import "@/test/dom";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";

import { EditMessage } from "../edit-message";

describe("EditMessage", () => {
  it("renders with initial text", () => {
    const { container } = render(
      <EditMessage
        initialText="Hello world"
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe("Hello world");
  });

  it("renders Save and Cancel buttons", () => {
    const { container } = render(
      <EditMessage initialText="Hello" onCancel={vi.fn()} onSave={vi.fn()} />
    );

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain("Cancel");
    expect(buttons[1].textContent).toContain("Save");
  });

  it("calls onSave when Save is clicked", () => {
    const handleSave = vi.fn();
    const { container } = render(
      <EditMessage
        initialText="Test message"
        onCancel={vi.fn()}
        onSave={handleSave}
      />
    );

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Save")
    );

    saveButton?.click();
    expect(handleSave).toHaveBeenCalledWith("Test message");
  });

  it("calls onCancel when Cancel is clicked", () => {
    const handleCancel = vi.fn();
    const { container } = render(
      <EditMessage
        initialText="Hello"
        onCancel={handleCancel}
        onSave={vi.fn()}
      />
    );

    const cancelButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Cancel")
    );

    cancelButton?.click();
    expect(handleCancel).toHaveBeenCalled();
  });

  it("disables controls when disabled prop is true", () => {
    const { container } = render(
      <EditMessage
        disabled
        initialText="Hello"
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);

    const buttons = container.querySelectorAll(
      "button"
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it("applies custom className", () => {
    const { container } = render(
      <EditMessage
        className="custom-class"
        initialText="Hello"
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(container.querySelector(".custom-class")).toBeTruthy();
  });

  it("renders without crashing when initialText is empty", () => {
    expect(() =>
      render(<EditMessage initialText="" onCancel={vi.fn()} onSave={vi.fn()} />)
    ).not.toThrow();
  });
});
