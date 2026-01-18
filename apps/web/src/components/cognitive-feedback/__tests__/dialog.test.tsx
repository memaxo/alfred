import "@/test/dom";

import { describe, expect, it, vi } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { DialogProvider } from "@/components/ui/dialog";
import { CognitiveFeedbackDialog } from "../dialog";

describe("CognitiveFeedbackDialog", () => {
  it("does not render dialog content when draft is null", () => {
    const { queryByText } = render(
      <CognitiveFeedbackDialog
        draft={null}
        onOpenChange={() => {}}
        onSubmit={() => {}}
        status="idle"
      />
    );

    expect(queryByText("Share Feedback")).toBeNull();
  });

  it("validates expected is required", () => {
    const onSubmit = vi.fn();
    const { getByText, getByLabelText } = render(
      <DialogProvider inline>
        <CognitiveFeedbackDialog
          draft={{
            streamId: "s1",
            expected: "Original expected",
            actual: "",
            intent: "negative",
            surface: "chat",
          }}
          onOpenChange={() => {}}
          onSubmit={onSubmit}
          status="idle"
        />
      </DialogProvider>
    );

    fireEvent.change(getByLabelText("Expected Result"), {
      target: { value: "" },
    });
    fireEvent.click(getByText("Submit Feedback"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(getByText("Required")).toBeTruthy();
  });

  it("submits trimmed values and includes surface", () => {
    const onSubmit = vi.fn();
    const { getByText, getByLabelText } = render(
      <DialogProvider inline>
        <CognitiveFeedbackDialog
          draft={{
            streamId: "s1",
            expected: "Original expected",
            actual: "",
            intent: "positive",
            surface: "mindscape",
          }}
          onOpenChange={() => {}}
          onSubmit={onSubmit}
          status="idle"
        />
      </DialogProvider>
    );

    fireEvent.change(getByLabelText("Expected Result"), {
      target: { value: "  New expected  " },
    });
    fireEvent.change(getByLabelText("What actually happened?"), {
      target: { value: "  actual text  " },
    });
    fireEvent.click(getByText("Submit Feedback"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      expected: "New expected",
      actual: "actual text",
      surface: "mindscape",
    });
  });

  it("disables submit when status is pending", () => {
    const onSubmit = vi.fn();
    const { getByText } = render(
      <DialogProvider inline>
        <CognitiveFeedbackDialog
          draft={{
            streamId: "s1",
            expected: "Expected",
            actual: "",
            intent: "negative",
            surface: "chat",
          }}
          onOpenChange={() => {}}
          onSubmit={onSubmit}
          status="pending"
        />
      </DialogProvider>
    );

    const btn = getByText("Submitting…").closest("button");
    expect(btn).toBeTruthy();
    expect(btn?.disabled).toBe(true);
  });
});
