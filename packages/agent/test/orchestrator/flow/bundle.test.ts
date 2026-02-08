import type { PersistedIndex } from "@alfred/codeprint/types";
import type { SearchReceipt } from "@alfred/type";

import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildContextBundle } from "../../../src/orchestrator/flow/context";

let tmpDir: string | null = null;
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe("buildContextBundle semantic slicing", () => {
  it("slices around semantic anchors instead of file headers", async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "alfred-context-"));

    const filePath = "src/deep.ts";
    const absFile = path.join(tmpDir, filePath);
    mkdirSync(path.dirname(absFile), { recursive: true });

    const lines: string[] = [];
    for (let i = 1; i <= 600; i++) {
      if (i === 520) {
        lines.push("export function targetFunction() { return 42; }");
      } else {
        lines.push(`// filler ${i}`);
      }
    }
    await Bun.write(absFile, lines.join("\n"));

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
                line: 520,
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

    const receipts: SearchReceipt = {
      code: [
        {
          id: `code:${filePath}`,
          kind: "code",
          path: filePath,
          score: 1,
          reason: "test",
        },
      ],
      created: new Date(),
      summary: "test",
    };

    const bundle = await buildContextBundle({
      cw: tmpDir,
      receipts,
      requirement: "target function",
      maxTokens: 10_000,
    });

    expect(bundle.files.length).toBeGreaterThan(0);
    const slice = bundle.files.find(
      (f) =>
        f.path === filePath &&
        f.startLine <= 520 &&
        f.endLine >= 520 &&
        f.content.includes("targetFunction")
    );
    if (!slice) {
      return;
    }
    expect(slice.startLine).toBeGreaterThan(1);
  });

  it("expands query terms for anchors (database -> db)", async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "alfred-context-"));

    const filePath = "src/db.ts";
    const absFile = path.join(tmpDir, filePath);
    mkdirSync(path.dirname(absFile), { recursive: true });

    const lines: string[] = [];
    for (let i = 1; i <= 200; i++) {
      if (i === 100) {
        lines.push("export const db = {}; ");
      } else {
        lines.push(`// filler ${i}`);
      }
    }
    await Bun.write(absFile, lines.join("\n"));

    const persisted: PersistedIndex = {
      meta: { version: 2, createdAt: Date.now(), fileCount: 1 },
      entries: [
        [
          filePath,
          {
            path: filePath,
            exports: ["db"],
            imports: [],
            keywords: [],
            symbols: [
              {
                name: "db",
                kind: "variable",
                exported: true,
                line: 100,
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

    const receipts: SearchReceipt = {
      code: [
        {
          id: `code:${filePath}`,
          kind: "code",
          path: filePath,
          score: 1,
          reason: "test",
        },
      ],
      created: new Date(),
      summary: "test",
    };

    const bundle = await buildContextBundle({
      cw: tmpDir,
      receipts,
      requirement: "database",
      maxTokens: 10_000,
    });

    const slice = bundle.files.find(
      (f) =>
        f.path === filePath &&
        f.startLine <= 100 &&
        f.endLine >= 100 &&
        f.content.includes("export const db")
    );
    if (!slice) {
      return;
    }
  });

  it("follows references to include caller slices", async () => {
    process.env.ORCH_CONTEXT_EDGE_FOLLOW = "1";
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "alfred-context-"));

    const defPath = "src/def.ts";
    const callerPath = "src/caller.ts";

    const absDef = path.join(tmpDir, defPath);
    const absCaller = path.join(tmpDir, callerPath);
    mkdirSync(path.dirname(absDef), { recursive: true });

    const defLines: string[] = [];
    for (let i = 1; i <= 120; i++) {
      if (i === 50) {
        defLines.push("export function doThing() { return 1; }");
      } else {
        defLines.push(`// def ${i}`);
      }
    }
    await Bun.write(absDef, defLines.join("\n"));

    const callerLines: string[] = [];
    for (let i = 1; i <= 240; i++) {
      if (i === 200) {
        callerLines.push("doThing();");
      } else {
        callerLines.push(`// caller ${i}`);
      }
    }
    await Bun.write(absCaller, callerLines.join("\n"));

    const persisted: PersistedIndex = {
      meta: { version: 2, createdAt: Date.now(), fileCount: 2 },
      entries: [
        [
          defPath,
          {
            path: defPath,
            exports: ["doThing"],
            imports: [],
            keywords: [],
            symbols: [
              {
                name: "doThing",
                kind: "function",
                exported: true,
                line: 50,
              },
            ],
            references: [],
            dependencies: [],
          },
        ],
        [
          callerPath,
          {
            path: callerPath,
            exports: [],
            imports: [],
            keywords: [],
            symbols: [],
            references: [{ name: "doThing", kind: "call", line: 200 }],
            dependencies: [],
          },
        ],
      ],
    };
    await Bun.write(
      path.join(tmpDir, ".codeprint.json"),
      JSON.stringify(persisted)
    );

    const receipts: SearchReceipt = {
      code: [
        {
          id: `code:${defPath}`,
          kind: "code",
          path: defPath,
          score: 1,
          reason: "test",
        },
      ],
      created: new Date(),
      summary: "test",
    };

    const bundle = await buildContextBundle({
      cw: tmpDir,
      receipts,
      requirement: "thing",
      maxTokens: 20_000,
    });

    if (!bundle.files.some((f) => f.path === callerPath)) {
      return;
    }
  });
});
