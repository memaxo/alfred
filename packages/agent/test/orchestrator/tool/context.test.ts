import type { PersistedIndex } from "@alfred/codeprint/types";

import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { toolContext } from "../../../src/orchestrator/tool/context";

let tmpDir: string | null = null;
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe("toolContext", () => {
  it("returns receipts + bundle without invoking analysis", async () => {
    process.env.ORCH_CONTEXT_NO_LLM = "1";
    process.env.CODEPRINT_ENABLED = "0";

    tmpDir = mkdtempSync(path.join(os.tmpdir(), "alfred-context-tool-"));

    const filePath = "src/target.ts";
    const absFile = path.join(tmpDir, filePath);
    mkdirSync(path.dirname(absFile), { recursive: true });
    await Bun.write(
      absFile,
      [
        "// header",
        "// filler",
        "export function targetFunction() { return 1; }",
      ].join("\n")
    );

    const persisted: PersistedIndex = {
      meta: { version: 2, createdAt: Date.now(), fileCount: 1 },
      entries: [
        [
          filePath,
          {
            path: filePath,
            exports: ["targetFunction"],
            imports: [],
            keywords: [],
            symbols: [
              {
                name: "targetFunction",
                kind: "function",
                exported: true,
                line: 3,
              },
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
        requirement: "target function",
        cw: tmpDir,
        topK: 5,
        maxTokens: 2000,
        includeAnalysis: false,
      },
    });

    expect(result.receipts.code.length).toBeGreaterThan(0);
    expect(result.bundle.files.length).toBeGreaterThan(0);
    expect(result.analysis).toBeUndefined();
    expect(result.intent?.filesToEdit.length).toBeGreaterThan(0);
    expect(
      result.bundle.files.some(
        (f) => f.path === filePath && f.content.includes("targetFunction")
      )
    ).toBe(true);
  });
});
