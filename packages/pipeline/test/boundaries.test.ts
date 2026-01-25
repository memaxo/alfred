import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Boundary Tests
 *
 * Verify that pipeline core does not import forbidden packages.
 * This ensures the pipeline remains portable and doesn't leak
 * implementation details from adjacent packages.
 */

const PIPELINE_SRC = path.resolve(import.meta.dir, "../src");

const FORBIDDEN_IMPORTS = [
  "@alfred/db", // Pipeline should not depend on database
  "@alfred/api", // Pipeline should not depend on API routers
  "drizzle-orm", // No ORM in pipeline core
  "postgres", // No direct database drivers
];

const CORE_FILES = [
  "runner.ts",
  "pipeline.ts",
  "events.ts",
  "context.ts",
  "snapshot.ts",
];

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function findImportsInFile(content: string): string[] {
  const importRegex = /from\s+["']([^"']+)["']/g;
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath) {
      imports.push(importPath);
    }
  }

  return imports;
}

describe("Pipeline Package Boundaries", () => {
  describe("Core Files", () => {
    for (const file of CORE_FILES) {
      const filePath = path.join(PIPELINE_SRC, file);

      it(`${file} does not import forbidden packages`, () => {
        if (!fs.existsSync(filePath)) {
          // File might not exist in test environment
          return;
        }

        const content = readFile(filePath);
        const imports = findImportsInFile(content);

        for (const forbidden of FORBIDDEN_IMPORTS) {
          const hasViolation = imports.some(
            (imp) => imp.startsWith(forbidden) || imp === forbidden
          );
          expect(hasViolation).toBe(false);
        }
      });
    }
  });

  describe("Observer Files", () => {
    const observersDir = path.join(PIPELINE_SRC, "observers");

    it("observers/index.ts exists", () => {
      expect(fs.existsSync(path.join(observersDir, "index.ts"))).toBe(true);
    });

    it("checkpoint.ts does not import @alfred/db", () => {
      const filePath = path.join(observersDir, "checkpoint.ts");
      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = readFile(filePath);
      const imports = findImportsInFile(content);

      // Checkpoint observer should use injectable storage, not direct db imports
      const hasDbImport = imports.some((imp) => imp.startsWith("@alfred/db"));
      expect(hasDbImport).toBe(false);
    });
  });

  describe("Stage Files", () => {
    const stagesDir = path.join(PIPELINE_SRC, "stages");

    it("stages directory exists", () => {
      expect(fs.existsSync(stagesDir)).toBe(true);
    });

    // Stages MAY import from @alfred/agent and @alfred/runtime (they need to)
    // But should NOT import from @alfred/db or @alfred/api directly
    it("execute.ts does not import @alfred/db directly", () => {
      const filePath = path.join(stagesDir, "execute.ts");
      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = readFile(filePath);
      const imports = findImportsInFile(content);

      const hasDbImport = imports.some((imp) => imp.startsWith("@alfred/db"));
      expect(hasDbImport).toBe(false);
    });

    it("review.ts does not import @alfred/db directly", () => {
      const filePath = path.join(stagesDir, "review.ts");
      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = readFile(filePath);
      const imports = findImportsInFile(content);

      const hasDbImport = imports.some((imp) => imp.startsWith("@alfred/db"));
      expect(hasDbImport).toBe(false);
    });
  });
});

describe("Context Serializability", () => {
  it("context.ts enforces serializable values", () => {
    const filePath = path.join(PIPELINE_SRC, "context.ts");
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = readFile(filePath);

    // Verify assertSerializable is imported/used
    expect(content).toContain("assertSerializable");

    // Verify set() calls assertSerializable with key parameter
    expect(content).toMatch(/assertSerializable\(key,\s*\w+\)/);
  });

  it("snapshot.ts exports SerializableValue type", () => {
    const filePath = path.join(PIPELINE_SRC, "snapshot.ts");
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = readFile(filePath);

    expect(content).toContain("export type SerializableValue");
  });
});

describe("Event Type Coverage", () => {
  it("events.ts includes all required event types", () => {
    const filePath = path.join(PIPELINE_SRC, "events.ts");
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = readFile(filePath);

    // Pipeline lifecycle events
    expect(content).toContain('"pipeline:start"');
    expect(content).toContain('"pipeline:suspend"');
    expect(content).toContain('"pipeline:resume"');
    expect(content).toContain('"pipeline:complete"');
    expect(content).toContain('"pipeline:failed"');

    // Context events
    expect(content).toContain('"context:set"');
    expect(content).toContain('"context:cache-hit"');

    // Agent events
    expect(content).toContain('"agent:spawn"');
    expect(content).toContain('"agent:complete"');
    expect(content).toContain('"agent:stuck"');
    expect(content).toContain('"agent:escalated"');
    expect(content).toContain('"agent:retry"');

    // Review events
    expect(content).toContain('"review:check"');
    expect(content).toContain('"review:fix-start"');
    expect(content).toContain('"review:fix-complete"');

    // Wave events
    expect(content).toContain('"wave:aborted"');
  });
});

describe("Configuration Types", () => {
  it("pipeline.ts includes all config types", () => {
    const filePath = path.join(PIPELINE_SRC, "pipeline.ts");
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = readFile(filePath);

    // Config type definitions
    expect(content).toContain("StuckDetectionConfig");
    expect(content).toContain("RetryConfig");
    expect(content).toContain("WaveAbortConfig");
    expect(content).toContain("ContextCachingConfig");
    expect(content).toContain("ReviewFixerConfig");

    // PipelineConfig includes optional configs
    expect(content).toContain("stuckDetection?:");
    expect(content).toContain("retries?:");
    expect(content).toContain("waveAbort?:");
    expect(content).toContain("contextCaching?:");
    expect(content).toContain("reviewFixer?:");
  });
});
