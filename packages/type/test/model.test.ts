import { describe, expect, it } from "bun:test";

import { parseModelKey, parseModelRef, toModelKey } from "../src/model";
import { modelRefSchema } from "../src/model.zod";

describe("parseModelRef", () => {
  it("parses openai refs", () => {
    const parsed = parseModelRef("openai:gpt-4o-mini");
    expect(parsed).toEqual({
      provider: "openai",
      modelId: "gpt-4o-mini",
      ref: "openai:gpt-4o-mini",
    });
  });

  it("parses openrouter refs with slashes", () => {
    const parsed = parseModelRef("openrouter:anthropic/claude-3.5-sonnet");
    expect(parsed.provider).toBe("openrouter");
    expect(parsed.modelId).toBe("anthropic/claude-3.5-sonnet");
    expect(parsed.ref).toBe("openrouter:anthropic/claude-3.5-sonnet");
  });

  it("parses cerebras refs", () => {
    const parsed = parseModelRef("cerebras:llama3.1-70b");
    expect(parsed.provider).toBe("cerebras");
    expect(parsed.modelId).toBe("llama3.1-70b");
    expect(parsed.ref).toBe("cerebras:llama3.1-70b");
  });

  it("canonicalizes whitespace around the ref", () => {
    const parsed = parseModelRef("  openai: gpt-4o-mini  ");
    expect(parsed.ref).toBe("openai:gpt-4o-mini");
    expect(parsed.provider).toBe("openai");
    expect(parsed.modelId).toBe("gpt-4o-mini");
  });

  it("rejects empty strings", () => {
    expect(() => parseModelRef("")).toThrow("model_ref_empty");
    expect(() => parseModelRef("   ")).toThrow("model_ref_empty");
  });

  it("rejects missing colon", () => {
    expect(() => parseModelRef("openai/gpt-4o-mini")).toThrow(
      "model_ref_missing_colon"
    );
  });

  it("rejects unknown providers", () => {
    expect(() => parseModelRef("gateway:gpt-4o-mini")).toThrow(
      "model_ref_provider_unknown"
    );
  });

  it("rejects empty providers", () => {
    expect(() => parseModelRef(":gpt-4o-mini")).toThrow(
      "model_ref_provider_empty"
    );
  });

  it("rejects empty modelIds", () => {
    expect(() => parseModelRef("openai:")).toThrow("model_ref_modelid_empty");
    expect(() => parseModelRef("openai:   ")).toThrow(
      "model_ref_modelid_empty"
    );
  });
});

describe("toModelKey", () => {
  it("converts refs to stable provider/model keys", () => {
    const openai = parseModelRef("openai:gpt-4o-mini");
    expect(toModelKey(openai.ref)).toBe("openai/gpt-4o-mini");

    const openrouter = parseModelRef("openrouter:anthropic/claude-3.5-sonnet");
    expect(toModelKey(openrouter.ref)).toBe(
      "openrouter/anthropic/claude-3.5-sonnet"
    );
  });
});

describe("parseModelKey", () => {
  it("parses openai keys", () => {
    const parsed = parseModelKey("openai/gpt-4o-mini");
    expect(parsed).toEqual({
      provider: "openai",
      modelId: "gpt-4o-mini",
      key: "openai/gpt-4o-mini",
    });
  });

  it("parses openrouter keys with slashes in modelId", () => {
    const parsed = parseModelKey("openrouter/anthropic/claude-3.5-sonnet");
    expect(parsed.provider).toBe("openrouter");
    expect(parsed.modelId).toBe("anthropic/claude-3.5-sonnet");
    expect(parsed.key).toBe("openrouter/anthropic/claude-3.5-sonnet");
  });

  it("parses cerebras keys", () => {
    const parsed = parseModelKey("cerebras/llama3.1-8b");
    expect(parsed.provider).toBe("cerebras");
    expect(parsed.modelId).toBe("llama3.1-8b");
    expect(parsed.key).toBe("cerebras/llama3.1-8b");
  });

  it("rejects empty strings", () => {
    expect(() => parseModelKey("")).toThrow("model_key_empty");
    expect(() => parseModelKey("   ")).toThrow("model_key_empty");
  });

  it("rejects missing slash", () => {
    expect(() => parseModelKey("openai:gpt-4o-mini")).toThrow(
      "model_key_missing_slash"
    );
  });

  it("rejects unknown providers", () => {
    expect(() => parseModelKey("gateway/gpt-4o-mini")).toThrow(
      "model_key_provider_unknown"
    );
  });
});

describe("modelRefSchema", () => {
  it("accepts openrouter ids with slashes", () => {
    const parsed = modelRefSchema.parse(
      "openrouter:anthropic/claude-3.5-sonnet"
    );
    expect(parsed).toBe("openrouter:anthropic/claude-3.5-sonnet");
  });

  it("accepts cerebras ids", () => {
    const parsed = modelRefSchema.parse("cerebras:llama3.1-70b");
    expect(parsed).toBe("cerebras:llama3.1-70b");
  });

  it("rejects missing colons", () => {
    const res = modelRefSchema.safeParse("openai/gpt-4o-mini");
    expect(res.success).toBe(false);
  });

  it("rejects unknown providers", () => {
    const res = modelRefSchema.safeParse("gateway:gpt-4o-mini");
    expect(res.success).toBe(false);
    if (res.success) {
      throw new Error("expected_model_ref_schema_error");
    }
    expect(res.error.issues[0]?.message).toBe("model_ref_provider_unknown");
  });

  it("trims and canonicalizes whitespace", () => {
    const parsed = modelRefSchema.parse("  openai: gpt-4o-mini  ");
    expect(parsed).toBe("openai:gpt-4o-mini");
  });
});
