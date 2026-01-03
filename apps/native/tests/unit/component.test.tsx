import { describe, expect, it, mock } from "bun:test";

// Simple mock for react-native
mock.module("react-native", () => ({
  View: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

describe("Basic Component Test", () => {
  it("should work", () => {
    expect(1 + 1).toBe(2);
  });
});
