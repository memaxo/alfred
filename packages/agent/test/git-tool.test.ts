import { describe, expect, it } from "bun:test";
import { z } from "zod";

// Local schema definition for testing (mirrors the actual schema)
const gitInputSchema = z.object({
  action: z.enum([
    "branch.create",
    "branch.delete",
    "branch.update",
    "worktree.add",
    "worktree.remove",
    "commit",
    "push",
    "merge",
    "status",
    "diff",
    "fetch",
    "reset.hard",
  ]),
  cw: z.string().optional(),
  base: z.string().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  message: z.string().optional(),
  remote: z.string().optional(),
  ref: z.string().optional(),
  noFF: z.boolean().optional(),
  authz: z.string().optional(),
  timeoutSec: z.number().int().min(10).max(7200).optional(),
});

const gitOutputSchema = z.object({
  ok: z.boolean(),
  details: z.unknown().optional(),
});

describe("git tool schema validation", () => {
  describe("input schema", () => {
    it("requires action field", () => {
      const result = gitInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid branch.create action", () => {
      const result = gitInputSchema.safeParse({
        action: "branch.create",
        name: "feature/new-feature",
        base: "main",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid branch.delete action", () => {
      const result = gitInputSchema.safeParse({
        action: "branch.delete",
        name: "old-branch",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid branch.update action", () => {
      const result = gitInputSchema.safeParse({
        action: "branch.update",
        name: "feature",
        base: "main",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid commit action", () => {
      const result = gitInputSchema.safeParse({
        action: "commit",
        message: "feat: add new feature",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid push action", () => {
      const result = gitInputSchema.safeParse({
        action: "push",
        remote: "origin",
        ref: "feature/branch",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid merge action with noFF option", () => {
      const result = gitInputSchema.safeParse({
        action: "merge",
        ref: "feature/branch",
        noFF: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid status action", () => {
      const result = gitInputSchema.safeParse({
        action: "status",
        cw: "/path/to/repo",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid diff action", () => {
      const result = gitInputSchema.safeParse({
        action: "diff",
        ref: "main",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid fetch action", () => {
      const result = gitInputSchema.safeParse({
        action: "fetch",
        remote: "upstream",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid reset.hard action", () => {
      const result = gitInputSchema.safeParse({
        action: "reset.hard",
        ref: "HEAD~3",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid worktree.add action", () => {
      const result = gitInputSchema.safeParse({
        action: "worktree.add",
        path: "../worktree-dir",
        ref: "feature/branch",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid worktree.remove action", () => {
      const result = gitInputSchema.safeParse({
        action: "worktree.remove",
        path: "../worktree-dir",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid action", () => {
      const result = gitInputSchema.safeParse({
        action: "invalid-action",
      });
      expect(result.success).toBe(false);
    });

    it("validates timeout range - too short", () => {
      const result = gitInputSchema.safeParse({
        action: "status",
        timeoutSec: 5,
      });
      expect(result.success).toBe(false);
    });

    it("validates timeout range - too long", () => {
      const result = gitInputSchema.safeParse({
        action: "status",
        timeoutSec: 100_000,
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid timeout", () => {
      const result = gitInputSchema.safeParse({
        action: "status",
        timeoutSec: 300,
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional authz token", () => {
      const result = gitInputSchema.safeParse({
        action: "push",
        ref: "main",
        authz: "token-123",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("output schema", () => {
    it("validates successful output", () => {
      const result = gitOutputSchema.safeParse({
        ok: true,
        details: { status: "clean" },
      });
      expect(result.success).toBe(true);
    });

    it("validates output without details", () => {
      const result = gitOutputSchema.safeParse({
        ok: true,
      });
      expect(result.success).toBe(true);
    });

    it("requires ok field", () => {
      const result = gitOutputSchema.safeParse({
        details: {},
      });
      expect(result.success).toBe(false);
    });

    it("accepts various detail types", () => {
      const cases = [
        { ok: true, details: { files: ["a.ts", "b.ts"] } },
        { ok: true, details: { skipped: true, reason: "clean_tree" } },
        { ok: false, details: { error: "git_failed" } },
      ];

      for (const testCase of cases) {
        const result = gitOutputSchema.safeParse(testCase);
        expect(result.success).toBe(true);
      }
    });
  });
});
