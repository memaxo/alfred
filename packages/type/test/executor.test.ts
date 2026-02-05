import { describe, expect, it } from "bun:test";

import {
  executorConfigPublicSchema,
  executorConfigWriteSchema,
  executorHealthSchema,
  executorStatusSchema,
} from "../src/executor.zod";

describe("executor schemas", () => {
  describe("executorConfigWriteSchema", () => {
    it("requires baseUrl when opencode transport=http", () => {
      const res = executorConfigWriteSchema.safeParse({
        kind: "opencode",
        transport: "http",
        v: 1,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(
          res.error.issues.some(
            (i) => i.message === "opencode_http_baseurl_required"
          )
        ).toBe(true);
      }
    });

    it("accepts http config including password for writes", () => {
      const res = executorConfigWriteSchema.safeParse({
        http: {
          baseUrl: "http://127.0.0.1:4096",
          password: "secret",
          username: "alfred",
        },
        kind: "opencode",
        transport: "http",
        v: 1,
      });
      expect(res.success).toBe(true);
    });
  });

  describe("executorConfigPublicSchema", () => {
    it("never returns password (strips unknown secret fields)", () => {
      const res = executorConfigPublicSchema.safeParse({
        http: {
          baseUrl: "http://127.0.0.1:4096",
          password: "secret",
          passwordSet: true,
          username: "alfred",
        },
        kind: "opencode",
        transport: "http",
        v: 1,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.kind).toBe("opencode");
        if (res.data.kind === "opencode") {
          expect(
            (res.data.http as { password?: unknown } | undefined)?.password
          ).toBeUndefined();
        }
      }
    });

    it("accepts public configs with passwordSet only", () => {
      const res = executorConfigPublicSchema.safeParse({
        http: {
          baseUrl: "http://127.0.0.1:4096",
          passwordSet: true,
          username: "alfred",
        },
        kind: "opencode",
        transport: "http",
        v: 1,
      });
      expect(res.success).toBe(true);
    });
  });

  describe("executorStatusSchema", () => {
    it("parses a minimal status payload", () => {
      const res = executorStatusSchema.safeParse({
        config: { exists: false, valid: false },
        containerContext: {
          present: true,
        },
        kind: "codex",
        supports: { execProfiles: ["default", "server"] },
      });
      expect(res.success).toBe(true);
    });
  });

  describe("executorHealthSchema", () => {
    it("requires datetime checkedAt", () => {
      const res = executorHealthSchema.safeParse({
        checkedAt: "not-a-date",
        kind: "opencode",
        ok: false,
      });
      expect(res.success).toBe(false);
    });
  });
});
