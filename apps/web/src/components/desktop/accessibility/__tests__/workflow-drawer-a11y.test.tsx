import "@/test/dom";
import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it, mock, vi } from "bun:test";

const useFocusTrapMock = vi.fn();

mock.module("@/components/desktop/accessibility/hooks", () => ({
  useFocusTrap: useFocusTrapMock,
}));

mock.module("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({
    children,
    showCloseButton: _showCloseButton,
    variant: _variant,
    ...props
  }: {
    children: React.ReactNode;
    showCloseButton?: boolean;
    variant?: string;
    "data-testid"?: string;
  }) => {
    const { ["data-testid"]: testId, ...rest } = props;
    return (
      <div data-testid={testId ?? "drawer-dialog"} role="dialog" {...rest}>
        {children}
      </div>
    );
  },
}));

mock.module("@/components/workflow-detail-modal", () => ({
  WorkflowDetailContent: () => <div data-testid="workflow-detail" />,
}));

mock.module("@/components/cognitive-feedback/controls", () => ({
  CognitiveFeedbackControls: () => null,
}));

mock.module("@/components/cognitive-feedback/dialog", () => ({
  CognitiveFeedbackDialog: () => null,
}));

mock.module("@/hooks/use-cognitive-feedback", () => ({
  useCognitiveFeedback: () => ({
    submit: vi.fn(),
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
}));

mock.module("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

mock.module("@/utils/trpc", () => ({
  trpc: {
    workflow: {
      get: {
        useQuery: () => ({
          data: {
            id: "run-1",
            status: "running",
            requirement: "Test requirement",
          },
          isSuccess: true,
        }),
      },
      events: { useQuery: () => ({ data: [] }) },
      reasoning: { useQuery: () => ({ data: null }) },
    },
  },
}));

let MindscapeWorkflowDrawer: typeof import("@/components/shared/workflow-drawer").MindscapeWorkflowDrawer;

describe("MindscapeWorkflowDrawer a11y", () => {
  beforeAll(async () => {
    ({ MindscapeWorkflowDrawer } =
      await import("@/components/shared/workflow-drawer"));
  });

  it("renders dialog content and enables focus trap", () => {
    const { getByTestId } = render(
      <MindscapeWorkflowDrawer onClose={vi.fn()} open runId="run-1" />
    );

    expect(getByTestId("mindscape-workflow-drawer")).toBeTruthy();
    expect(getByTestId("workflow-detail")).toBeTruthy();
    expect(useFocusTrapMock).toHaveBeenCalledWith(expect.any(Object), true);
  });
});
