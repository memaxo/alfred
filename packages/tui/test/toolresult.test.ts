import { describe, expect, test } from "bun:test";

import {
  formatToolResult,
  truncateToolResult,
} from "../src/tui/react/toolresult";

describe("tool result formatting", () => {
  test("formats success with content", () => {
    const text = formatToolResult({
      content: "output line",
      isError: false,
      toolName: "list_files",
    });
    expect(text).toContain("✓ list_files completed");
    expect(text).toContain("output line");
  });

  test("formats error with content", () => {
    const text = formatToolResult({
      content: "failed",
      isError: true,
      toolName: "write_file",
    });
    expect(text).toContain("✗ write_file failed");
    expect(text).toContain("failed");
  });

  test("truncates long content", () => {
    const longText = "a".repeat(2000);
    const truncated = truncateToolResult(longText, 120);
    expect(truncated.length).toBe(120);
    expect(truncated.endsWith("…")).toBe(true);
  });
});
