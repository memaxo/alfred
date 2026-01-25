import { describe, expect, it, mock } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const loadConfig = mock(() => {});
const loadHooksJsonFile = mock(async () => ({ version: 1, hooks: {} }));

mock.module("@alfred/hooks", () => {
  return {
    createHookRegistry: () => {
      return {
        on: () => () => {},
        emit: async () => ({}),
        loadConfig,
        registeredEvents: () => [],
      };
    },
    loadHooksJsonFile,
  };
});

mock.module("@alfred/hookpipe", () => {
  return {
    HooksObserver: class HooksObserver {
      constructor(public readonly args: unknown) {}
    },
  };
});

import { RuntimeContext } from "@alfred/type/runtime-context";

import { attachHooksObserver, ensureHooksRuntime } from "../src/workflow/hooks";

describe("api workflow hooks", () => {
  it("ensureHooksRuntime sets runtimeContext hooks and loads hooks.json when present", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "alfred-hooks-"));
    await fs.writeFile(
      path.join(dir, "hooks.json"),
      JSON.stringify({ version: 1, hooks: {} })
    );

    try {
      const ctx = new RuntimeContext<Record<string, unknown>>();
      await ensureHooksRuntime(ctx, {
        sessionId: "session-1",
        signal: new AbortController().signal,
        workspace: dir,
        workflowId: "workflow-1",
      });

      expect(ctx.get("hooks" as any)).toBeDefined();
      expect(loadHooksJsonFile).toHaveBeenCalledTimes(1);
      expect(loadConfig).toHaveBeenCalledTimes(1);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("attachHooksObserver attaches a HooksObserver", async () => {
    const runner = {
      addObserver: mock((_o: unknown) => {}),
    };
    await attachHooksObserver(runner as any, {
      runId: "workflow-1",
      sessionId: "session-1",
      signal: new AbortController().signal,
      workspace: process.cwd(),
    });

    expect(runner.addObserver).toHaveBeenCalledTimes(1);
  });
});
