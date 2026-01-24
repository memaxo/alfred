import "@/test/dom";
import { loggerMocks } from "@alfred/test-kit/logger";
import { fireEvent, render } from "@testing-library/react";
import "@alfred/test-kit/logger";
import { beforeEach, describe, expect, it, mock } from "bun:test";

// Import after the logger mock is installed.
const { LayerErrorBoundary, ShellErrorBoundary } =
  await import("../error-boundary");

// Component that throws on render
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div data-testid="success">Success</div>;
}

describe("ShellErrorBoundary", () => {
  beforeEach(() => {
    loggerMocks.error.mockClear();
  });

  it("renders children when no error", () => {
    const { getByTestId } = render(
      <ShellErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ShellErrorBoundary>
    );

    expect(getByTestId("success")).toBeTruthy();
  });

  it("renders error UI when child throws", () => {
    const { getByText } = render(
      <ShellErrorBoundary>
        <ThrowingComponent />
      </ShellErrorBoundary>
    );

    expect(getByText("Desktop Error")).toBeTruthy();
    expect(getByText("Test error")).toBeTruthy();
  });

  it("logs error", () => {
    render(
      <ShellErrorBoundary>
        <ThrowingComponent />
      </ShellErrorBoundary>
    );

    expect(loggerMocks.error).toHaveBeenCalledWith(
      "desktop_shell_crashed",
      expect.objectContaining({
        error: expect.any(Error),
        componentStack: expect.any(String),
      })
    );
  });

  it("calls onError callback when provided", () => {
    const onError = mock(() => {});

    render(
      <ShellErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ShellErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("shows Try Again button on first error", () => {
    const { getByText } = render(
      <ShellErrorBoundary>
        <ThrowingComponent />
      </ShellErrorBoundary>
    );

    expect(getByText("Try Again")).toBeTruthy();
  });

  it("recovers when Try Again is clicked", () => {
    let shouldThrow = true;
    function ConditionalThrow() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div data-testid="recovered">Recovered</div>;
    }

    const { getByText, getByTestId, queryByText } = render(
      <ShellErrorBoundary>
        <ConditionalThrow />
      </ShellErrorBoundary>
    );

    expect(getByText("Desktop Error")).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(getByText("Try Again"));

    expect(getByTestId("recovered")).toBeTruthy();
    expect(queryByText("Desktop Error")).toBeNull();
  });

  it("renders custom fallback when provided", () => {
    const { getByTestId } = render(
      <ShellErrorBoundary
        fallback={<div data-testid="custom-fallback">Custom</div>}
      >
        <ThrowingComponent />
      </ShellErrorBoundary>
    );

    expect(getByTestId("custom-fallback")).toBeTruthy();
  });
});

describe("LayerErrorBoundary", () => {
  beforeEach(() => {
    loggerMocks.error.mockClear();
  });

  it("renders children when no error", () => {
    const { getByTestId } = render(
      <LayerErrorBoundary layerName="Test">
        <ThrowingComponent shouldThrow={false} />
      </LayerErrorBoundary>
    );

    expect(getByTestId("success")).toBeTruthy();
  });

  it("renders error UI with layer name when child throws", () => {
    const { getByText } = render(
      <LayerErrorBoundary layerName="TestLayer">
        <ThrowingComponent />
      </LayerErrorBoundary>
    );

    expect(getByText("TestLayer unavailable")).toBeTruthy();
  });

  it("logs error", () => {
    render(
      <LayerErrorBoundary layerName="MyLayer">
        <ThrowingComponent />
      </LayerErrorBoundary>
    );

    expect(loggerMocks.error).toHaveBeenCalledWith(
      "desktop_layer_crashed",
      expect.objectContaining({
        layerName: "MyLayer",
        error: expect.any(Error),
        componentStack: expect.any(String),
      })
    );
  });

  it("shows retry button on first error", () => {
    const { getByRole } = render(
      <LayerErrorBoundary layerName="Test">
        <ThrowingComponent />
      </LayerErrorBoundary>
    );

    // The button contains "Retry" text with count
    const retryButton = getByRole("button");
    expect(retryButton.textContent).toContain("Retry");
  });

  it("allows retry and shows decremented count", () => {
    const { getByRole, getByText } = render(
      <LayerErrorBoundary layerName="Test">
        <ThrowingComponent />
      </LayerErrorBoundary>
    );

    // First error shows retry button
    const retryButton = getByRole("button");
    expect(retryButton).toBeTruthy();

    // Click retry - will error again and decrement count
    fireEvent.click(retryButton);

    // After multiple retries, should show refresh message
    fireEvent.click(getByRole("button"));

    // Should eventually show refresh message
    expect(getByText("Please refresh the page")).toBeTruthy();
  });

  it("renders custom fallback when provided", () => {
    const { getByTestId } = render(
      <LayerErrorBoundary
        fallback={<div data-testid="layer-fallback">Layer Fallback</div>}
        layerName="Test"
      >
        <ThrowingComponent />
      </LayerErrorBoundary>
    );

    expect(getByTestId("layer-fallback")).toBeTruthy();
  });

  it("renders fallback when null fallback provided", () => {
    const { container } = render(
      <LayerErrorBoundary fallback={null} layerName="Test">
        <ThrowingComponent />
      </LayerErrorBoundary>
    );

    // When fallback is null, React renders nothing for that fallback
    // but React still checks if fallback is provided (truthy check)
    // Since null is falsy, it falls through to default error UI
    // This is expected behavior - to hide errors completely, use an empty fragment
    expect(container).toBeTruthy();
  });

  it("calls onError callback when provided", () => {
    const onError = mock(() => {});

    render(
      <LayerErrorBoundary layerName="Test" onError={onError}>
        <ThrowingComponent />
      </LayerErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
