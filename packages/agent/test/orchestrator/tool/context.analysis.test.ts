import type { PersistedIndex } from "@alfred/codeprint/types";

import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const originalEnv = { ...process.env };

mock.module("../../../src/services/aigeneration.ts", () => ({
  DefaultAIAdapter: class {
    async generateObject() {
      return {
        object: {
          summary: "ok",
          architecture: [
            {
              title: "t",
              detail: "d",
              citations: [{ path: "missing.ts", startLine: 1, endLine: 2 }],
            },
          ],
          hotspots: [],
          changePlan: [],
          tests: [],
          risks: [],
        },
      };
    }
  },
}));
mock.module("../../../src/services/aigeneration.js", () => ({
  DefaultAIAdapter: class {
    async generateObject() {
      return {
        object: {
          summary: "ok",
          architecture: [
            {
              title: "t",
              detail: "d",
              citations: [{ path: "missing.ts", startLine: 1, endLine: 2 }],
            },
          ],
          hotspots: [],
          changePlan: [],
          tests: [],
          risks: [],
        },
      };
    }
  },
}));

import { toolContext } from "../../../src/orchestrator/tool/context";

let tmpDir: string | null = null;

afterEach(() => {
  process.env = { ...originalEnv };
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

afterAll(() => {
  mock.restore();
});

describe("toolContext analysis citation validation", () => {
  it("drops invalid citations and marks insufficient evidence", async () => {
    process.env.ORCH_CONTEXT_NO_LLM = "1";
    process.env.CODEPRINT_ENABLED = "0";

    tmpDir = mkdtempSync(path.join(os.tmpdir(), "alfred-context-tool-"));

    const filePath = "src/target.ts";
    const absFile = path.join(tmpDir, filePath);
    mkdirSync(path.dirname(absFile), { recursive: true });
    await Bun.write(absFile, "export const target = 1;\n");

    const persisted: PersistedIndex = {
      meta: { version: 2, createdAt: Date.now(), fileCount: 1 },
      entries: [
        [
          filePath,
          {
            path: filePath,
            exports: ["target"],
            imports: [],
            keywords: [],
            symbols: [
              { name: "target", kind: "variable", exported: true, line: 1 },
            ],
            references: [],
            dependencies: [],
          },
        ],
      ],
    };
    await Bun.write(
      path.join(tmpDir, ".codeprint.json"),
      JSON.stringify(persisted)
    );

    const result = await toolContext.execute({
      input: {
        requirement: "target",
        cw: tmpDir,
        includeAnalysis: true,
      },
    });

    expect(result.analysis).toBeDefined();
    const first = result.analysis?.architecture[0];
    expect(first?.citations.length).toBe(0);
    expect(first?.detail.toLowerCase().includes("insufficient")).toBe(true);
  });
});
