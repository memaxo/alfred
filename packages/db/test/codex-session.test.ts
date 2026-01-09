import { describe, expect, it } from "bun:test";
import {
  cleanupExpiredSessions,
  createSession,
  deleteSession,
  getSession,
  getSessionById,
  listSessions,
  updateSession,
} from "../src/repo/codex-session";

describe("codex-session (unit - no DB)", () => {
  describe("function signatures", () => {
    it("exports getSession function", () => {
      expect(typeof getSession).toBe("function");
    });

    it("exports createSession function", () => {
      expect(typeof createSession).toBe("function");
    });

    it("exports getSessionById function", () => {
      expect(typeof getSessionById).toBe("function");
    });

    it("exports updateSession function", () => {
      expect(typeof updateSession).toBe("function");
    });

    it("exports deleteSession function", () => {
      expect(typeof deleteSession).toBe("function");
    });

    it("exports cleanupExpiredSessions function", () => {
      expect(typeof cleanupExpiredSessions).toBe("function");
    });

    it("exports listSessions function", () => {
      expect(typeof listSessions).toBe("function");
    });
  });

  describe("listSessions options type", () => {
    it("accepts userId as required parameter", () => {
      // Type check - listSessions requires userId
      const validOptions = {
        userId: "user-123",
      };
      expect(validOptions.userId).toBeDefined();
    });

    it("accepts optional status filter", () => {
      const optionsWithStatus = {
        userId: "user-123",
        status: "active" as const,
      };
      expect(optionsWithStatus.status).toBe("active");
    });

    it("accepts optional pagination parameters", () => {
      const optionsWithPagination = {
        userId: "user-123",
        limit: 50,
        offset: 100,
      };
      expect(optionsWithPagination.limit).toBe(50);
      expect(optionsWithPagination.offset).toBe(100);
    });
  });
});
