/**
 * Breadcrumbs Component Tests
 */

import "@/test/dom";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";

const { Breadcrumbs } = await import("../breadcrumbs");

describe("Breadcrumbs", () => {
  describe("rendering", () => {
    it("renders path segments correctly", () => {
      const { getByText } = render(
        <Breadcrumbs path="/src/components/Button.tsx" />
      );
      expect(getByText("src")).toBeDefined();
      expect(getByText("components")).toBeDefined();
      expect(getByText("Button.tsx")).toBeDefined();
    });

    it("renders file icon", () => {
      const { container } = render(<Breadcrumbs path="/src/index.ts" />);
      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("highlights the last segment", () => {
      const { getByText } = render(
        <Breadcrumbs path="/src/components/Button.tsx" />
      );
      const lastSegment = getByText("Button.tsx");
      expect(lastSegment.className).toContain("text-biolum");
    });

    it("applies dimmed style to non-last segments", () => {
      const { getByText } = render(
        <Breadcrumbs path="/src/components/Button.tsx" />
      );
      const firstSegment = getByText("src");
      expect(firstSegment.className).toContain("text-biolum-dim");
    });

    it("handles single segment paths", () => {
      const { getByText } = render(<Breadcrumbs path="/README.md" />);
      expect(getByText("README.md")).toBeDefined();
    });

    it("applies custom className", () => {
      const { container } = render(
        <Breadcrumbs className="custom-class" path="/src/index.ts" />
      );
      expect((container.firstChild as HTMLElement).className).toContain(
        "custom-class"
      );
    });
  });

  describe("navigation", () => {
    it("calls onNavigate with correct path when segment is clicked", () => {
      const onNavigate = vi.fn();
      const { getByText } = render(
        <Breadcrumbs
          onNavigate={onNavigate}
          path="/src/components/Button.tsx"
        />
      );
      fireEvent.click(getByText("components"));
      expect(onNavigate).toHaveBeenCalledWith("/src/components");
    });

    it("calls onNavigate for the last segment too", () => {
      const onNavigate = vi.fn();
      const { getByText } = render(
        <Breadcrumbs
          onNavigate={onNavigate}
          path="/src/components/Button.tsx"
        />
      );
      fireEvent.click(getByText("Button.tsx"));
      expect(onNavigate).toHaveBeenCalledWith("/src/components/Button.tsx");
    });

    it("does not throw when onNavigate is not provided", () => {
      const { getByText } = render(
        <Breadcrumbs path="/src/components/Button.tsx" />
      );
      expect(() => fireEvent.click(getByText("src"))).not.toThrow();
    });
  });

  describe("accessibility", () => {
    it("all segments are buttons", () => {
      const { getByText } = render(
        <Breadcrumbs path="/src/components/Button.tsx" />
      );
      const srcButton = getByText("src");
      expect(srcButton.tagName.toLowerCase()).toBe("button");
    });

    it("buttons have type attribute", () => {
      const { getByText } = render(
        <Breadcrumbs path="/src/components/Button.tsx" />
      );
      const srcButton = getByText("src");
      expect(srcButton.getAttribute("type")).toBe("button");
    });
  });
});
