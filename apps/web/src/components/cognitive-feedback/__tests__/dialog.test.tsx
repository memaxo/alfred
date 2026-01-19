import "@/test/dom";

import { describe, expect, it, vi } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
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

  it("validates expected is required", async () => {
    const onSubmit = vi.fn();
    const { container, findByText, getByLabelText } = render(
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
    await findByText("Submit Feedback");

    const expected = getByLabelText("Expected Result") as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(expected, {
        target: { value: "" },
      });
    });
    expect(expected.value).toBe("");

    act(() => {
      const formEl = container.querySelector("form");
      expect(formEl).toBeTruthy();
      fireEvent.submit(formEl as HTMLFormElement);
    });
    await Promise.resolve();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await findByText("Required")).toBeTruthy();
  });

  it("submits trimmed values and includes surface", async () => {
    const onSubmit = vi.fn();
    const { container, findByText, getByLabelText } = render(
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
    await findByText("Submit Feedback");

    const expected = getByLabelText("Expected Result") as HTMLTextAreaElement;
    const actual = getByLabelText(
      "What actually happened?"
    ) as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.change(expected, {
        target: { value: "  New expected  " },
      });
      fireEvent.change(actual, {
        target: { value: "  actual text  " },
      });
      await Promise.resolve();
    });
    expect(expected.value).toBe("  New expected  ");
    expect(actual.value).toBe("  actual text  ");

    await act(async () => {
      const formEl = container.querySelector("form");
      expect(formEl).toBeTruthy();
      fireEvent.submit(formEl as HTMLFormElement);
      await Promise.resolve();
    });

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

  it("renders error message when error is provided", async () => {
    const { findByText } = render(
      <DialogProvider inline>
        <CognitiveFeedbackDialog
          draft={{
            streamId: "s1",
            expected: "Expected",
            actual: "",
            intent: "negative",
            surface: "chat",
          }}
          error={new Error("boom")}
          onOpenChange={() => {}}
          onSubmit={() => {}}
          status="idle"
        />
      </DialogProvider>
    );

    expect(await findByText("boom")).toBeTruthy();
  });

  it("invokes onOpenChange(false) when closed", async () => {
    const onOpenChange = vi.fn();
    const { findAllByRole } = render(
      <DialogProvider inline>
        <CognitiveFeedbackDialog
          draft={{
            streamId: "s1",
            expected: "Expected",
            actual: "",
            intent: "positive",
            surface: "mindscape",
          }}
          onOpenChange={onOpenChange}
          onSubmit={() => {}}
          status="idle"
        />
      </DialogProvider>
    );

    const closeButtons = await findAllByRole("button", { name: "Close" });
    const closeButton =
      closeButtons.find((b) => b.getAttribute("data-slot") === "button") ??
      closeButtons[0];
    expect(closeButton).toBeTruthy();
    act(() => {
      fireEvent.click(closeButton);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
