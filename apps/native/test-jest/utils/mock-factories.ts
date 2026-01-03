/**
 * Mock Factories
 *
 * Generates mock data for testing.
 */

export function createMockNote(overrides: Partial<any> = {}) {
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

export function createMockReminder(overrides: Partial<any> = {}) {
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

export function createMockBookmark(overrides: Partial<any> = {}) {
  return {
    id: `book-${Math.random().toString(36).substr(2, 9)}`,
    url: "https://example.com",
    title: "Example Domain",
    created: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockMessage(overrides: Partial<any> = {}) {
  return {
    id: `msg-${Math.random().toString(36).substr(2, 9)}`,
    role: "user",
    content: "Hello ALFRED!",
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createMockArray<T>(
  factory: (i: number) => T,
  count: number
): T[] {
  return Array.from({ length: count }, (_, i) => factory(i));
}
