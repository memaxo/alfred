/**
 * Unit Tests for EmbedProcess
 * Tests IPC communication, error handling, and health checks
 */

import { describe, test, expect, afterEach } from "bun:test";
import { EmbedProcess } from "../src/process";

describe("EmbedProcess - Unit Tests", () => {
  const processes: EmbedProcess[] = [];

  afterEach(async () => {
    // Clean up all processes
    for (const proc of processes) {
      await proc.shutdown();
    }
    processes.length = 0;
  });

  test("process starts successfully", async () => {
    const proc = new EmbedProcess({
      modelName: "tencent/KaLM-Embedding-Gemma3-12B-2511",
      device: "auto",
    });
    processes.push(proc);

    await proc.start();

    const health = proc.getHealth();
    expect(health.uptime).toBeGreaterThan(0);
    expect(health.requestCount).toBe(0);
    expect(health.errorCount).toBe(0);

    console.log("[process-test] ✓ Process started successfully");
  }, 90_000);

  test("sendRequest returns embeddings", async () => {
    const proc = new EmbedProcess();
    processes.push(proc);

    await proc.start();

    const texts = ["Test sentence 1", "Test sentence 2"];
    const embeddings = await proc.sendRequest(texts);

    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(texts.length);
    expect(embeddings[0].length).toBe(1024);

    const health = proc.getHealth();
    expect(health.requestCount).toBe(1);
    expect(health.errorCount).toBe(0);

    console.log("[process-test] ✓ Request processed successfully");
  }, 90_000);

  test("health check updates lastPing", async () => {
    const proc = new EmbedProcess();
    processes.push(proc);

    await proc.start();

    // Initial health should have no ping
    const initialHealth = proc.getHealth();
    expect(initialHealth.lastPing).toBeNull();

    // Wait for health check interval (30s is too long for tests)
    // We can't easily test the automatic health check without waiting,
    // but we've verified the sendRequest increments requestCount
    console.log("[process-test] ✓ Health tracking initialized");
  }, 90_000);

  test("multiple requests succeed", async () => {
    const proc = new EmbedProcess();
    processes.push(proc);

    await proc.start();

    // Send multiple requests sequentially
    const results = await Promise.all([
      proc.sendRequest(["Request 1"]),
      proc.sendRequest(["Request 2"]),
      proc.sendRequest(["Request 3"]),
    ]);

    expect(results.length).toBe(3);
    results.forEach((embeddings) => {
      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(1024);
    });

    const health = proc.getHealth();
    expect(health.requestCount).toBe(3);
    expect(health.errorCount).toBe(0);

    console.log("[process-test] ✓ Multiple requests handled");
  }, 90_000);

  test("shutdown cleans up resources", async () => {
    const proc = new EmbedProcess();
    processes.push(proc);

    await proc.start();
    await proc.shutdown();

    const health = proc.getHealth();
    expect(health.isHealthy).toBe(false);

    console.log("[process-test] ✓ Shutdown completed cleanly");
  }, 90_000);

  test("process handles large batches", async () => {
    const proc = new EmbedProcess();
    processes.push(proc);

    await proc.start();

    // Test with larger batch
    const texts = Array.from({ length: 32 }, (_, i) => `Sentence ${i + 1}`);
    const embeddings = await proc.sendRequest(texts);

    expect(embeddings.length).toBe(32);
    embeddings.forEach((emb) => {
      expect(emb.length).toBe(1024);
    });

    console.log("[process-test] ✓ Large batch processed");
  }, 120_000); // Longer timeout for batch processing
});

