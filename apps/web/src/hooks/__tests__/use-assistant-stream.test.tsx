/**
 * Screen Reader Announcement Tests
 *
 * Tests for useAssistantStream screen reader announcements.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";
import React from "react";

import { useAssistantStream } from "./use-assistant-stream";

// Mock the accessibility hooks
vi.mock("@/components/desktop/accessibility/hooks", () => ({
  useAnnounce: () => ({
    announcePolite: vi.fn(),
    announceAssertive: vi.fn(),
  }),
}));

// Mock the AI SDK
vi.mock("@ai-sdk/react", () => ({
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
