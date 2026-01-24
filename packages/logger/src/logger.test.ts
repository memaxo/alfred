import { beforeEach, describe, expect, it, vi } from "bun:test";

import { configure, logger } from "./index";

describe("logger", () => {
  const lines: string[] = [];
  const transport = {
    write: vi.fn((line: string) => {
      lines.push(line);
    }),
  };

  beforeEach(() => {
    lines.length = 0;
    transport.write.mockClear();
    configure({
      service: "test-service",
      environment: "production",
      level: "debug",
      transport,
    });
  });

  it("logs JSON in non-development environments", () => {
    logger.info("hello world");
    expect(transport.write).toHaveBeenCalledTimes(1);

    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello world");
    expect(parsed.service).toBe("test-service");
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.environment).toBe("production");
  });

  it("includes structured context fields at the top-level", () => {
    logger.warn("something happened", { userId: "123", foo: "bar" });
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.level).toBe("warn");
    expect(parsed.userId).toBe("123");
    expect(parsed.foo).toBe("bar");
  });

  it("supports child logger context propagation", () => {
    const runLogger = logger.child({ runId: "run-1" });
    runLogger.info("started", { step: 1 });
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.runId).toBe("run-1");
    expect(parsed.step).toBe(1);
  });

  it("supports per-call context overriding child context", () => {
    const runLogger = logger.child({ runId: "run-1", foo: "a" });
    runLogger.info("event", { foo: "b" });
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.runId).toBe("run-1");
    expect(parsed.foo).toBe("b");
  });

  it("redacts common secret keys", () => {
    logger.info("auth", { token: "secret", password: "p", apiKey: "k" });
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.apiKey).toBe("[REDACTED]");
  });

  it("does not redact common ID fields", () => {
    logger.info("voice", { sessionId: "session-123", tokenId: "token-456" });
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.sessionId).toBe("session-123");
    expect(parsed.tokenId).toBe("token-456");
  });

  it("does not crash on circular references", () => {
    const ctx: Record<string, unknown> = { a: 1 };
    ctx.self = ctx;
    logger.info("circular", ctx);
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.a).toBe(1);
    // The logger flattens context into the entry, so a circular reference can
    // show up as a nested object with a circular marker inside.
    if (parsed.self === "[Circular]") {
      expect(parsed.self).toBe("[Circular]");
      return;
    }
    expect(parsed.self?.self).toBe("[Circular]");
  });

  it("normalizes Error objects", () => {
    logger.error("failed", { error: new Error("boom") });
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.error?.message).toBe("boom");
    expect(parsed.error?.name).toBe("Error");
  });

  it("pretty-prints in development", () => {
    configure({ environment: "development" });
    logger.error("critical error", { runId: "run-1" });
    expect(transport.write).toHaveBeenCalled();
    expect(lines[0]).toContain("ERROR");
    expect(lines[0]).toContain("critical error");
    expect(lines[0]).toContain("run-1");
  });

  describe("Levels", () => {
    beforeEach(() => {
      configure({ environment: "production", level: "debug" });
    });

    it("should support debug", () => {
      logger.debug("msg");
      const parsed = JSON.parse(lines[0] ?? "");
      expect(parsed.level).toBe("debug");
    });

    it("should support info", () => {
      logger.info("msg");
      const parsed = JSON.parse(lines[0] ?? "");
      expect(parsed.level).toBe("info");
    });

    it("should support warn", () => {
      logger.warn("msg");
      const parsed = JSON.parse(lines[0] ?? "");
      expect(parsed.level).toBe("warn");
    });

    it("should support error", () => {
      logger.error("msg");
      const parsed = JSON.parse(lines[0] ?? "");
      expect(parsed.level).toBe("error");
    });
  });

  describe("Configuration", () => {
    beforeEach(() => {
      configure({ environment: "production" });
    });

    it("should update service name", () => {
      configure({ service: "new-service" });
      logger.info("test");
      const parsed = JSON.parse(lines[0] ?? "");
      expect(parsed.service).toBe("new-service");
    });
  });
});
