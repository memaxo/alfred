/**
 * Context Builder Tests
 *
 * Tests context caching, cache key computation, and TTL expiration
 */

import { beforeEach, describe, expect, it } from "bun:test";

import { ContextBuilder } from "../src/context";

describe("ContextBuilder", () => {
  let builder: ContextBuilder;

  beforeEach(() => {
    builder = new ContextBuilder();
  });

  it("builds context for requirement", async () => {
    const context = await builder.build({
      requirement: "test requirement",
      workspace: "/tmp/test",
    });

    expect(context).toHaveProperty("requirement");
    expect(context).toHaveProperty("receipts");
    expect(context).toHaveProperty("bundle");
    expect(context).toHaveProperty("totalTokens");
    expect(context.requirement).toBe("test requirement");
  });

  it("caches context for same input", async () => {
    const input = {
      requirement: "test requirement",
      workspace: "/tmp/test",
    };

    const context1 = await builder.build(input);
    const context2 = await builder.build(input);

    // Should return same cached instance
    expect(context1).toBe(context2);
    expect(builder.getCacheSize()).toBe(1);
  });

  it("generates different cache keys for different inputs", async () => {
    const context1 = await builder.build({
      requirement: "requirement 1",
      workspace: "/tmp/test1",
    });

    const context2 = await builder.build({
      requirement: "requirement 2",
      workspace: "/tmp/test2",
    });

    // Should be different instances
    expect(context1).not.toBe(context2);
    expect(builder.getCacheSize()).toBe(2);
  });

  it("respects topK in cache key", async () => {
    const context1 = await builder.build({
      requirement: "test",
      workspace: "/tmp/test",
      topK: 10,
    });

    const context2 = await builder.build({
      requirement: "test",
      workspace: "/tmp/test",
      topK: 20,
    });

    // Different topK should produce different cache entries
    expect(context1).not.toBe(context2);
    expect(builder.getCacheSize()).toBe(2);
  });

  it("respects web flag in cache key", async () => {
    const context1 = await builder.build({
      requirement: "test",
      workspace: "/tmp/test",
      web: false,
    });

    const context2 = await builder.build({
      requirement: "test",
      workspace: "/tmp/test",
      web: true,
    });

    // Different web flag should produce different cache entries
    expect(context1).not.toBe(context2);
    expect(builder.getCacheSize()).toBe(2);
  });

  it("clears cache", async () => {
    await builder.build({
      requirement: "test",
      workspace: "/tmp/test",
    });

    expect(builder.getCacheSize()).toBe(1);
    builder.clearCache();
    expect(builder.getCacheSize()).toBe(0);
  });

  it("includes web receipts when web enabled", async () => {
    const context = await builder.build({
      requirement: "test",
      workspace: "/tmp/test",
      web: true,
    });

    expect(context.receipts.web).toBeDefined();
  });

  it("excludes web receipts when web disabled", async () => {
    const context = await builder.build({
      requirement: "test",
      workspace: "/tmp/test",
      web: false,
    });

    expect(context.receipts.web).toBeUndefined();
  });
});
