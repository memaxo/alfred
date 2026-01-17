import { describe, expect, it } from "bun:test";

import { normalizeModelLabel } from "../src/adapters/ai";

describe("normalizeModelLabel", () => {
  it("normalizes cerebras provider refs to model keys", () => {
    expect(normalizeModelLabel("cerebras:llama3.1-8b")).toBe(
      "cerebras/llama3.1-8b"
    );
    expect(normalizeModelLabel("cerebras/llama3.1-8b")).toBe(
      "cerebras/llama3.1-8b"
    );
  });

  it("normalizes openrouter provider refs to model keys", () => {
    expect(normalizeModelLabel("openrouter:anthropic/claude-3.5-sonnet")).toBe(
      "openrouter/anthropic/claude-3.5-sonnet"
    );
    expect(normalizeModelLabel("openrouter/anthropic/claude-3.5-sonnet")).toBe(
      "openrouter/anthropic/claude-3.5-sonnet"
    );
  });

  it("returns unknown for empty strings", () => {
    expect(normalizeModelLabel("")).toBe("unknown");
    expect(normalizeModelLabel("   ")).toBe("unknown");
  });

  it("passes through unknown providers after slash normalization", () => {
    // If the provider is unknown, we still normalize ":" -> "/" but avoid throwing.
    expect(normalizeModelLabel("gateway:gpt-4o-mini")).toBe(
      "gateway/gpt-4o-mini"
    );
  });
});
