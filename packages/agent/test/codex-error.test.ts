import { describe, expect, it } from "bun:test";
import { CodexError } from "../src/orchestrator/tool/codex/error";

describe("CodexError", () => {
  describe("constructor", () => {
    it("creates error with stage and code", () => {
      const error = new CodexError("spawn", "codex_binary_not_found");
      expect(error.name).toBe("CodexError");
      expect(error.stage).toBe("spawn");
      expect(error.code).toBe("codex_binary_not_found");
      expect(error.message).toBe("codex_binary_not_found");
      expect(error.detail).toBeUndefined();
    });

    it("includes detail in message when provided", () => {
      const error = new CodexError("runtime", "codex_exec_failed", "connection reset");
      expect(error.message).toBe("codex_exec_failed:connection reset");
      expect(error.detail).toBe("connection reset");
    });
  });

  describe("isRetryable", () => {
    it("marks spawn errors as retryable", () => {
      const error = new CodexError("spawn", "codex_binary_not_found");
      expect(error.isRetryable).toBe(true);
    });

    it("marks timeout errors as retryable", () => {
      const error = new CodexError("timeout", "codex_exec_timeout");
      expect(error.isRetryable).toBe(true);
    });

    it("marks runtime errors as not retryable", () => {
      const error = new CodexError("runtime", "codex_exec_failed");
      expect(error.isRetryable).toBe(false);
    });

    it("marks parse errors as not retryable", () => {
      const error = new CodexError("parse", "codex_exec_failed");
      expect(error.isRetryable).toBe(false);
    });

    it("marks session errors as not retryable", () => {
      const error = new CodexError("session", "codex_session_user_required");
      expect(error.isRetryable).toBe(false);
    });
  });

  describe("static factories", () => {
    it("spawn() creates spawn-stage error", () => {
      const error = CodexError.spawn("codex_binary_not_found", "not in PATH");
      expect(error.stage).toBe("spawn");
      expect(error.code).toBe("codex_binary_not_found");
      expect(error.detail).toBe("not in PATH");
      expect(error.isRetryable).toBe(true);
    });

    it("timeout() creates timeout-stage error", () => {
      const error = CodexError.timeout("exceeded 30s");
      expect(error.stage).toBe("timeout");
      expect(error.code).toBe("codex_exec_timeout");
      expect(error.detail).toBe("exceeded 30s");
      expect(error.isRetryable).toBe(true);
    });

    it("timeout() works without detail", () => {
      const error = CodexError.timeout();
      expect(error.stage).toBe("timeout");
      expect(error.code).toBe("codex_exec_timeout");
      expect(error.message).toBe("codex_exec_timeout");
    });

    it("runtime() creates runtime-stage error", () => {
      const error = CodexError.runtime("turn failed");
      expect(error.stage).toBe("runtime");
      expect(error.code).toBe("codex_exec_failed");
      expect(error.detail).toBe("turn failed");
      expect(error.isRetryable).toBe(false);
    });

    it("session() creates session-stage error", () => {
      const error = CodexError.session("codex_session_forbidden", "user mismatch");
      expect(error.stage).toBe("session");
      expect(error.code).toBe("codex_session_forbidden");
      expect(error.detail).toBe("user mismatch");
      expect(error.isRetryable).toBe(false);
    });

    it("parse() creates parse-stage error", () => {
      const error = CodexError.parse("invalid JSON");
      expect(error.stage).toBe("parse");
      expect(error.code).toBe("codex_exec_failed");
      expect(error.detail).toBe("invalid JSON");
      expect(error.isRetryable).toBe(false);
    });
  });

  describe("inheritance", () => {
    it("extends Error", () => {
      const error = CodexError.timeout();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof CodexError).toBe(true);
    });

    it("has stack trace", () => {
      const error = CodexError.runtime("test");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("CodexError");
    });
  });
});
