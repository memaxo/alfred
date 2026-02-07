import { render, screen } from "@testing-library/react";
import { describe, expect, it, mock, vi } from "bun:test";

const useFocusTrapMock = vi.fn();

mock.module("@/components/desktop/accessibility/hooks", () => ({
  useFocusTrap: useFocusTrapMock,
}));

mock.module("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="drawer-dialog" role="dialog" {...props}>
      {children}
    </div>
  ),
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

import { MindscapeWorkflowDrawer } from "../workflow-drawer";

describe("MindscapeWorkflowDrawer a11y", () => {
  it("renders dialog content and enables focus trap", () => {
    render(<MindscapeWorkflowDrawer onClose={vi.fn()} open runId="run-1" />);

    expect(screen.getByTestId("drawer-dialog")).toBeTruthy();
    expect(screen.getByTestId("workflow-detail")).toBeTruthy();
    expect(useFocusTrapMock).toHaveBeenCalledWith(expect.any(Object), true);
  });
});
