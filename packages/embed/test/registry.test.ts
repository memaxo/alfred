/**
 * Embedding Registry Tests
 * Tests for model switching, provider management, and capability detection
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  type EmbeddingInput,
  type EmbeddingModelConfig,
  type EmbeddingProvider,
  EmbeddingRegistry,
  getRegistry,
  MODEL_CONFIGS,
  MODEL_IDS,
  resetRegistry,
} from "../src/registry";

/**
 * Mock embedding provider for testing
 */
function createMockProvider(
  config: Partial<EmbeddingModelConfig> = {}
): EmbeddingProvider {
  const fullConfig: EmbeddingModelConfig = {
    id: config.id ?? "mock-provider",
    name: config.name ?? "Mock Provider",
    dimensions: config.dimensions ?? 1024,
    capabilities: config.capabilities ?? {
      text: true,
      image: false,
      video: false,
    },
  };

  let initialized = false;

  return {
    config: fullConfig,
    async embed(input: EmbeddingInput): Promise<number[]> {
      if (!initialized) {
        throw new Error("Provider not initialized");
      }
      // Return a deterministic mock embedding based on input
      const seed = JSON.stringify(input).length;
      return Array.from(
        { length: fullConfig.dimensions },
        (_, i) => Math.sin(seed + i) * 0.5
      );
    },
    async embedMany(inputs: EmbeddingInput[]): Promise<number[][]> {
      return Promise.all(inputs.map((input) => this.embed(input)));
    },
    isHealthy(): boolean {
      return initialized;
    },
    async initialize(): Promise<void> {
      initialized = true;
    },
    async shutdown(): Promise<void> {
      initialized = false;
    },
  };
}

describe("EmbeddingRegistry", () => {
  let registry: EmbeddingRegistry;

  beforeEach(() => {
    registry = new EmbeddingRegistry();
  });

  afterEach(async () => {
    await registry.shutdownAll();
  });

  test("registers and retrieves providers", () => {
    const provider = createMockProvider({ id: "test-1" });
    registry.register(provider);

    expect(registry.has("test-1")).toBe(true);
    expect(registry.get("test-1")).toBe(provider);
  });

  test("throws on duplicate registration", () => {
    const provider1 = createMockProvider({ id: "test-1" });
    const provider2 = createMockProvider({ id: "test-1" });

    registry.register(provider1);
    expect(() => registry.register(provider2)).toThrow(
      'Provider with ID "test-1" is already registered'
    );
  });

  test("sets and gets default provider", () => {
    const provider1 = createMockProvider({ id: "test-1" });
    const provider2 = createMockProvider({ id: "test-2" });

    registry.register(provider1);
    registry.register(provider2);
    registry.setDefault("test-2");

    expect(registry.getDefaultId()).toBe("test-2");
    expect(registry.getDefault()).toBe(provider2);
  });

  test("throws when getting non-existent provider", () => {
    expect(() => registry.get("non-existent")).toThrow(
      'Provider with ID "non-existent" not found'
    );
  });

  test("throws when getting default without setting one", () => {
    expect(() => registry.getDefault()).toThrow(
      "No default provider set and no ID specified"
    );
  });

  test("unregisters providers", () => {
    const provider = createMockProvider({ id: "test-1" });
    registry.register(provider);
    registry.setDefault("test-1");

    registry.unregister("test-1");

    expect(registry.has("test-1")).toBe(false);
    expect(registry.getDefaultId()).toBeNull();
  });

  test("finds provider by capability - text", () => {
    const textProvider = createMockProvider({
      id: "text-only",
      capabilities: { text: true, image: false, video: false },
    });
    registry.register(textProvider);

    const found = registry.findByCapability("text");
    expect(found).toBe(textProvider);
  });

  test("finds provider by capability - image", () => {
    const textProvider = createMockProvider({
      id: "text-only",
      capabilities: { text: true, image: false, video: false },
    });
    const multimodalProvider = createMockProvider({
      id: "multimodal",
      capabilities: { text: true, image: true, video: true },
    });

    registry.register(textProvider);
    registry.register(multimodalProvider);

    const found = registry.findByCapability("image");
    expect(found).toBe(multimodalProvider);
  });

  test("finds provider by capability - mixed", () => {
    const textProvider = createMockProvider({
      id: "text-only",
      capabilities: { text: true, image: false, video: false },
    });
    const multimodalProvider = createMockProvider({
      id: "multimodal",
      capabilities: { text: true, image: true, video: false },
    });

    registry.register(textProvider);
    registry.register(multimodalProvider);

    const found = registry.findByCapability("mixed");
    expect(found).toBe(multimodalProvider);
  });

  test("returns null when no provider supports capability", () => {
    const textProvider = createMockProvider({
      id: "text-only",
      capabilities: { text: true, image: false, video: false },
    });
    registry.register(textProvider);

    const found = registry.findByCapability("image");
    expect(found).toBeNull();
  });

  test("prefers default provider when finding by capability", () => {
    const provider1 = createMockProvider({
      id: "provider-1",
      capabilities: { text: true, image: false, video: false },
    });
    const provider2 = createMockProvider({
      id: "provider-2",
      capabilities: { text: true, image: false, video: false },
    });

    registry.register(provider1);
    registry.register(provider2);
    registry.setDefault("provider-2");

    const found = registry.findByCapability("text");
    expect(found).toBe(provider2);
  });

  test("lists all provider IDs", () => {
    registry.register(createMockProvider({ id: "a" }));
    registry.register(createMockProvider({ id: "b" }));
    registry.register(createMockProvider({ id: "c" }));

    const ids = registry.getIds();
    expect(ids).toHaveLength(3);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
  });

  test("initializes all providers", async () => {
    const provider1 = createMockProvider({ id: "p1" });
    const provider2 = createMockProvider({ id: "p2" });

    registry.register(provider1);
    registry.register(provider2);

    await registry.initializeAll();

    expect(provider1.isHealthy()).toBe(true);
    expect(provider2.isHealthy()).toBe(true);
  });

  test("shuts down all providers", async () => {
    const provider1 = createMockProvider({ id: "p1" });
    const provider2 = createMockProvider({ id: "p2" });

    registry.register(provider1);
    registry.register(provider2);
    await registry.initializeAll();

    await registry.shutdownAll();

    expect(provider1.isHealthy()).toBe(false);
    expect(provider2.isHealthy()).toBe(false);
    expect(registry.getIds()).toHaveLength(0);
  });
});

describe("MODEL_CONFIGS", () => {
  test("has KaLM configuration", () => {
    const config = MODEL_CONFIGS[MODEL_IDS.KALM_12B];

    expect(config.id).toBe("kalm-12b-1024");
    expect(config.name).toBe("tencent/KaLM-Embedding-Gemma3-12B-2511");
    expect(config.dimensions).toBe(1024);
    expect(config.capabilities.text).toBe(true);
    expect(config.capabilities.image).toBe(false);
    expect(config.capabilities.video).toBe(false);
  });

  test("has Qwen configuration", () => {
    const config = MODEL_CONFIGS[MODEL_IDS.QWEN3_VL_2B];

    expect(config.id).toBe("qwen3-vl-2b-1024");
    expect(config.name).toBe("Qwen/Qwen3-VL-Embedding-2B");
    expect(config.dimensions).toBe(1024);
    expect(config.capabilities.text).toBe(true);
    expect(config.capabilities.image).toBe(true);
    expect(config.capabilities.video).toBe(true);
  });
});

describe("Global Registry", () => {
  afterEach(() => {
    resetRegistry();
  });

  test("creates singleton registry", () => {
    const registry1 = getRegistry();
    const registry2 = getRegistry();

    expect(registry1).toBe(registry2);
  });

  test("resets global registry", () => {
    const registry1 = getRegistry();
    registry1.register(createMockProvider({ id: "test" }));

    resetRegistry();
    const registry2 = getRegistry();

    expect(registry2).not.toBe(registry1);
    expect(registry2.has("test")).toBe(false);
  });
});

describe("Provider Embedding", () => {
  test("generates embeddings after initialization", async () => {
    const provider = createMockProvider({
      id: "test",
      dimensions: 128,
    });

    await provider.initialize();

    const input: EmbeddingInput = { type: "text", content: "Hello, world!" };
    const embedding = await provider.embed(input);

    expect(embedding).toHaveLength(128);
    expect(embedding.every((v) => typeof v === "number")).toBe(true);
  });

  test("throws when embedding before initialization", async () => {
    const provider = createMockProvider({ id: "test" });

    const input: EmbeddingInput = { type: "text", content: "Hello" };
    await expect(provider.embed(input)).rejects.toThrow(
      "Provider not initialized"
    );
  });

  test("generates batch embeddings", async () => {
    const provider = createMockProvider({
      id: "test",
      dimensions: 64,
    });

    await provider.initialize();

    const inputs: EmbeddingInput[] = [
      { type: "text", content: "First" },
      { type: "text", content: "Second" },
      { type: "text", content: "Third" },
    ];

    const embeddings = await provider.embedMany(inputs);

    expect(embeddings).toHaveLength(3);
    for (const embedding of embeddings) {
      expect(embedding).toHaveLength(64);
    }
  });
});
