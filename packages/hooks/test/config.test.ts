import type {
  HookContext,
  HooksJsonConfig,
  WorkflowStartEvent,
} from "@alfred/type";

import { afterEach, describe, expect, it } from "bun:test";

import { createHookRegistry } from "../src/registry";

interface SpawnResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr?: string;
}

const realSpawn = Bun.spawn;

function setSpawnMock(map: Record<string, SpawnResult>): void {
  Bun.spawn = ((argv: readonly string[]) => {
    const cmd = argv.at(-1);
    if (!cmd) {
      throw new Error("hook_test_missing_command");
    }
    const res = map[cmd];
    if (!res) {
      throw new Error(`hook_test_unexpected_command:${cmd}`);
    }

    const stdin = {
      write() {
        return 0;
      },
      end() {
        return Promise.resolve(0);
      },
    };

    return {
      stdin,
      stdout: new Response(res.stdout).body,
      stderr: new Response(res.stderr ?? "").body,
      exited: Promise.resolve(res.exitCode),
      kill() {},
    } as any;
  }) as typeof Bun.spawn;
}

afterEach(() => {
  Bun.spawn = realSpawn;
});

function createCtx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    sessionId: "s1",
    workflowId: "w1",
    autonomy: 0.5,
    cognitive: {
      state: "idle",
      autonomy: 0.5,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    },
    alfredVersion: "dev",
    emit: async () => {},
    signal: new AbortController().signal,
    log: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    ...overrides,
  };
}

describe("hooks config", () => {
  it("executes command hooks from hooks.json", async () => {
    const reg = createHookRegistry();
    const allow = "allow";

    setSpawnMock({
      [allow]: {
        exitCode: 0,
        stdout: JSON.stringify({ userMessage: "allow:workflow:start" }),
      },
    });

    const config: HooksJsonConfig = {
      version: 1,
      hooks: {
        "workflow:start": [{ command: allow }],
      },
    };

    reg.loadConfig(config);

    const event: WorkflowStartEvent = {
      type: "workflow:start",
      workflowId: "wf",
      taskSummary: "a",
    };

    const out = await reg.emit(event, createCtx());
    expect(out.userMessage).toBe("allow:workflow:start");
  });

  it("respects deny and skip semantics", async () => {
    const reg = createHookRegistry();
    const skip = "skip";
    const deny = "deny";

    setSpawnMock({
      [skip]: {
        exitCode: 4,
        stdout: JSON.stringify({ userMessage: "skip:workflow:start" }),
      },
      [deny]: {
        exitCode: 2,
        stdout: JSON.stringify({ reason: "deny:workflow:start" }),
      },
    });

    const config: HooksJsonConfig = {
      version: 1,
      hooks: {
        "workflow:start": [{ command: skip }, { command: deny }],
      },
    };

    reg.loadConfig(config);

    const out = await reg.emit(
      { type: "workflow:start", workflowId: "wf", taskSummary: "a" },
      createCtx()
    );

    expect(out.userMessage).toBe("skip:workflow:start");
    expect(out.decision).toBeUndefined();
  });
});
