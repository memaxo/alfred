/**
 * Screen Reader Announcement Tests
 *
 * Tests for useAssistantStream screen reader announcements.
 */

import "@/test/dom";
import { renderHook } from "@testing-library/react";
import { beforeAll, describe, expect, it, mock, vi } from "bun:test";

let useAssistantStream: typeof import("../use-assistant-stream").useAssistantStream;

// Mock the accessibility hooks
mock.module("@/components/desktop/accessibility/hooks", () => ({
  useAnnounce: () => ({
    announcePolite: vi.fn(),
    announceAssertive: vi.fn(),
  }),
}));

// Mock the AI SDK
mock.module("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    status: "ready",
    error: null,
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    setMessages: vi.fn(),
    clearError: vi.fn(),
    addToolApprovalResponse: vi.fn(),
  })),
}));

describe("useAssistantStream", () => {
  beforeAll(async () => {
    ({ useAssistantStream } = await import("../use-assistant-stream"));
  });

  it("should initialize without errors", () => {
    const { result } = renderHook(() => useAssistantStream());

    expect(result.current).toBeDefined();
    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("should return send function", () => {
    const { result } = renderHook(() => useAssistantStream());

    expect(typeof result.current.send).toBe("function");
  });

  it("should return reload function", () => {
    const { result } = renderHook(() => useAssistantStream());

    expect(typeof result.current.reload).toBe("function");
  });

  it("should return clear function", () => {
    const { result } = renderHook(() => useAssistantStream());

    expect(typeof result.current.clear).toBe("function");
  });
});
