import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { join } from "node:path";

// Mock policy enforcement
const mockRequireToolScopesAndPolicy = mock(() =>
  Promise.resolve({ claims: {}, decision: { obligations: [] } })
);

mock.module("@alfred/auth/token", () => ({
  requireToolScopesAndPolicy: mockRequireToolScopesAndPolicy,
}));

import { toolReflect } from "../src/orchestrator/tool/reflect";

describe("reflect tool", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(os.tmpdir(), "alfred-reflect-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Create .ruler directory
    mkdirSync(join(tempDir, ".ruler"), { recursive: true });

    mockRequireToolScopesAndPolicy.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("input schema validation", () => {
    it("requires outcome and learnings", () => {
      const result = toolReflect.inputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid success outcome", () => {
      const result = toolReflect.inputSchema.safeParse({
        outcome: "success",
        learnings: ["Always run tests before committing"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid failure outcome", () => {
      const result = toolReflect.inputSchema.safeParse({
        outcome: "failure",
        learnings: ["Check database connection first"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional taskId", () => {
      const result = toolReflect.inputSchema.safeParse({
        outcome: "success",
        learnings: ["Learning 1"],
        taskId: "task-123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional domain", () => {
      const result = toolReflect.inputSchema.safeParse({
        outcome: "success",
        learnings: ["Learning 1"],
        domain: "database",
      });
      expect(result.success).toBe(true);
    });

    it("requires at least one learning", () => {
      const result = toolReflect.inputSchema.safeParse({
        outcome: "success",
        learnings: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid outcome values", () => {
      const result = toolReflect.inputSchema.safeParse({
        outcome: "partial",
        learnings: ["Learning 1"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("execute", () => {
    describe("without domain", () => {
      it("appends learnings to 99-learned.md", async () => {
        const result = await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Always validate input before processing"],
          },
        });

        expect(result.success).toBe(true);
        expect(result.fileUpdated).toContain("99-learned.md");

        const content = readFileSync(
          join(tempDir, ".ruler", "99-learned.md"),
          "utf8"
        );
        expect(content).toContain("## Learned Rules");
        expect(content).toContain("- Always validate input before processing");
      });

      it("appends multiple learnings", async () => {
        const result = await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Learning one", "Learning two", "Learning three"],
          },
        });

        expect(result.success).toBe(true);

        const content = readFileSync(
          join(tempDir, ".ruler", "99-learned.md"),
          "utf8"
        );
        expect(content).toContain("- Learning one");
        expect(content).toContain("- Learning two");
        expect(content).toContain("- Learning three");
      });

      it("appends to existing file", async () => {
        const existingContent = "# Existing Rules\n\nSome content here.\n";
        writeFileSync(
          join(tempDir, ".ruler", "99-learned.md"),
          existingContent
        );

        await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["New learning"],
          },
        });

        const content = readFileSync(
          join(tempDir, ".ruler", "99-learned.md"),
          "utf8"
        );
        expect(content).toContain("# Existing Rules");
        expect(content).toContain("## Learned Rules");
        expect(content).toContain("- New learning");
      });
    });

    describe("with domain", () => {
      it("appends to database domain file", async () => {
        writeFileSync(
          join(tempDir, ".ruler", "04-database.md"),
          "# Database Rules\n"
        );

        const result = await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Always use transactions for multi-step operations"],
            domain: "database",
          },
        });

        expect(result.success).toBe(true);
        expect(result.fileUpdated).toContain("04-database.md");

        const content = readFileSync(
          join(tempDir, ".ruler", "04-database.md"),
          "utf8"
        );
        expect(content).toContain("- Always use transactions");
      });

      it("maps domain aliases correctly", async () => {
        writeFileSync(join(tempDir, ".ruler", "04-database.md"), "# DB\n");
        writeFileSync(join(tempDir, ".ruler", "05-testing.md"), "# Test\n");

        // Test 'db' alias
        await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["DB rule"],
            domain: "db",
          },
        });
        expect(
          readFileSync(join(tempDir, ".ruler", "04-database.md"), "utf8")
        ).toContain("- DB rule");

        // Test 'test' alias
        await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Test rule"],
            domain: "test",
          },
        });
        expect(
          readFileSync(join(tempDir, ".ruler", "05-testing.md"), "utf8")
        ).toContain("- Test rule");
      });

      it("falls back to 99-learned.md for unknown domain", async () => {
        const result = await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Unknown domain rule"],
            domain: "unknown-domain",
          },
        });

        expect(result.success).toBe(true);
        expect(result.fileUpdated).toContain("99-learned.md");
      });
    });

    describe("deduplication", () => {
      it("does not duplicate existing learnings", async () => {
        const existingContent =
          "# Rules\n\n## Learned Rules\n\n- Existing learning\n";
        writeFileSync(
          join(tempDir, ".ruler", "99-learned.md"),
          existingContent
        );

        const result = await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Existing learning"],
          },
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain("already present");

        const content = readFileSync(
          join(tempDir, ".ruler", "99-learned.md"),
          "utf8"
        );
        const occurrences = (content.match(/Existing learning/g) || []).length;
        expect(occurrences).toBe(1);
      });
    });

    describe("policy enforcement", () => {
      it("enforces reflect.write scope", async () => {
        await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Test learning"],
          },
        });

        expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
          undefined,
          ["reflect.write"],
          expect.objectContaining({
            action: "reflect.codify",
            resource: {
              kind: "ruler",
              id: "general",
            },
          })
        );
      });

      it("uses domain as resource id when provided", async () => {
        writeFileSync(join(tempDir, ".ruler", "04-database.md"), "# DB\n");

        await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Test learning"],
            domain: "database",
          },
        });

        expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
          undefined,
          ["reflect.write"],
          expect.objectContaining({
            resource: {
              kind: "ruler",
              id: "database",
            },
          })
        );
      });

      it("includes authz token when provided", async () => {
        await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["Test learning"],
            authz: "token-123",
          },
        });

        expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
          "token-123",
          ["reflect.write"],
          expect.any(Object)
        );
      });
    });

    describe("output", () => {
      it("returns ruler:apply instruction", async () => {
        const result = await toolReflect.execute({
          input: {
            outcome: "success",
            learnings: ["New learning"],
          },
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain("ruler:apply");
        expect(result.message).toContain("AGENTS.md");
      });
    });
  });

  describe("output schema", () => {
    it("validates successful output", () => {
      const result = toolReflect.outputSchema.safeParse({
        success: true,
        fileUpdated: "/path/to/file.md",
        message: "Learnings codified",
      });
      expect(result.success).toBe(true);
    });

    it("allows optional fileUpdated", () => {
      const result = toolReflect.outputSchema.safeParse({
        success: true,
        message: "Already present",
      });
      expect(result.success).toBe(true);
    });

    it("requires success and message", () => {
      const result = toolReflect.outputSchema.safeParse({
        success: true,
      });
      expect(result.success).toBe(false);
    });
  });
});
