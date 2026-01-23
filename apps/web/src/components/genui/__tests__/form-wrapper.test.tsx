/**
 * GenUI Form Wrapper Tests
 *
 * Tests the GenUIFormWrapper component integration with TanStack Form.
 */

import "@/test/dom";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { UIComponent } from "@alfred/type/genui";
import { render, screen } from "@testing-library/react";
import { GenUIFormWrapper } from "../form-wrapper";

function newId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Mock the submit hook
const mockSubmit = {
  submit: mock(async () => {}),
  isLoading: false,
  error: null,
};

// Mock the form hook
const mockForm = {
  AppForm: ({ children }: { children: React.ReactNode }) => (
    <form>{children}</form>
  ),
  Subscribe: ({
    children,
  }: {
    children: (state: {
      canSubmit: boolean;
      isSubmitting: boolean;
    }) => React.ReactNode;
  }) => <>{children({ canSubmit: true, isSubmitting: false })}</>,
};

beforeEach(() => {
  // Reset mocks
  mockSubmit.isLoading = false;
  mockSubmit.error = null;

  // Mock modules
  mock.module("@/hooks/submit", () => ({
    useSubmit: () => mockSubmit,
  }));

  mock.module("@/form", () => ({
    useAppForm: () => mockForm,
  }));
});

describe("GenUIFormWrapper", () => {
  const conversationId = `conv-${newId()}`;
  const formId = `form-${newId()}`;

  it("renders form with schema", () => {
    const schema: UIComponent = {
      component: "text",
      props: {
        label: "Name",
        name: "name",
      },
    };

    render(
      <GenUIFormWrapper
        conversationId={conversationId}
        formId={formId}
        schema={schema}
      />
    );

    // Form should render (basic check)
    expect(screen.getByRole("form")).toBeDefined();
  });

  it("displays error when submission fails", () => {
    const error = new Error("Submission failed");
    mockSubmit.error = error;

    const schema: UIComponent = {
      component: "text",
      props: {},
    };

    render(
      <GenUIFormWrapper
        conversationId={conversationId}
        formId={formId}
        schema={schema}
      />
    );

    expect(screen.getByText(/Form submission error/i)).toBeDefined();
  });

  it("displays loading state", () => {
    mockSubmit.isLoading = true;
    mockSubmit.error = null;

    const schema: UIComponent = {
      component: "text",
      props: {},
    };

    render(
      <GenUIFormWrapper
        conversationId={conversationId}
        formId={formId}
        schema={schema}
      />
    );

    expect(screen.getByText(/Submitting/i)).toBeDefined();
  });

  it("generates formId when not provided", () => {
    const schema: UIComponent = {
      component: "text",
      props: {},
    };

    render(
      <GenUIFormWrapper conversationId={conversationId} schema={schema} />
    );

    // Should render without error (formId generated internally)
    expect(screen.getByRole("form")).toBeDefined();
  });

  it("handles formData with default values", () => {
    const schema: UIComponent = {
      component: "text",
      props: {},
    };

    const formData = {
      defaultValues: {
        name: "Default Name",
      },
    };

    render(
      <GenUIFormWrapper
        conversationId={conversationId}
        formData={formData}
        formId={formId}
        schema={schema}
      />
    );

    expect(screen.getByRole("form")).toBeDefined();
  });
});
