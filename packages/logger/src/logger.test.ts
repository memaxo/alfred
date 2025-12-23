import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { configure, logger } from "./index";

describe("logger", () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    configure({ service: "test-service" });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("JSON formatting (non-development)", () => {
    beforeEach(() => {
      configure({ environment: "production" });
    });

    it("should log info message as JSON", () => {
      logger.info("hello world");
      expect(consoleLogSpy).toHaveBeenCalled();

      const callArg = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(callArg as string);

      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("hello world");
      expect(parsed.service).toBe("test-service");
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.environment).toBe("production");
    });

    it("should include context in JSON", () => {
      logger.warn("something happened", { userId: "123", foo: "bar" });

      const callArg = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(callArg as string);

      expect(parsed.level).toBe("warn");
      expect(parsed.userId).toBe("123");
      expect(parsed.foo).toBe("bar");
    });
  });

  describe("Pretty printing (development)", () => {
    beforeEach(() => {
      configure({ environment: "development" });
    });

    it("should log readable string prefix", () => {
      logger.error("critical error");

      expect(consoleLogSpy).toHaveBeenCalled();
      const callArgs = consoleLogSpy.mock.calls[0];
      expect(callArgs[0]).toBe("[ERROR] critical error");
    });

    it("should pass context as second argument", () => {
      const context = { error: "failed" };
      logger.debug("debugging", context);

      expect(consoleLogSpy).toHaveBeenCalled();
      const callArgs = consoleLogSpy.mock.calls[0];
      expect(callArgs[0]).toBe("[DEBUG] debugging");
      expect(callArgs[1]).toEqual(context);
    });
  });

  describe("Levels", () => {
    beforeEach(() => {
      configure({ environment: "production" });
    });

    it("should support debug", () => {
      logger.debug("msg");
      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe("debug");
    });

    it("should support info", () => {
      logger.info("msg");
      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe("info");
    });

    it("should support warn", () => {
      logger.warn("msg");
      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe("warn");
    });

    it("should support error", () => {
      logger.error("msg");
      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
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
      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(parsed.service).toBe("new-service");
    });
  });
});
