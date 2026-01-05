/**
 * Mock Factories
 *
 * Generates mock data for testing.
 */

import type { UIMessage } from "@alfred/type";

export function createMockNote(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: `note-${Math.random().toString(36).substr(2, 9)}`,
    title: "Test Note",
    content: "This is a test note content.",
    tags: ["test", "mock"],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockReminder(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: `remind-${Math.random().toString(36).substr(2, 9)}`,
    title: "Test Reminder",
    description: "This is a test reminder description.",
    due: new Date(Date.now() + 86_400_000).toISOString(),
    fired: false,
    created: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockBookmark(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: `book-${Math.random().toString(36).substr(2, 9)}`,
    url: "https://example.com",
    title: "Example Domain",
    created: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockMessage(
  overrides: Partial<UIMessage> & { content?: string } = {}
): UIMessage {
  const { content: contentOverride, ...messageOverrides } = overrides;
  const content = contentOverride ?? "Hello ALFRED!";
  return {
    id: `msg-${Math.random().toString(36).substr(2, 9)}`,
    role: "user",
    parts: [
      {
        type: "text",
        text: content,
      },
    ],
    ...messageOverrides,
  };
}

export function createMockArray<T>(
  factory: (i: number) => T,
  count: number
): T[] {
  return Array.from({ length: count }, (_, i) => factory(i));
}
