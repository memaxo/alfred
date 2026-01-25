import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  __internals as serverRegistry,
  stopAllServers,
} from "../shared/server.js";
import { __internals } from "./exec";
import {
  executeWithOpenCode,
  __internals as opencodeInternals,
} from "./exec.js";

interface FakeFileSink {
  write: (chunk: Uint8Array) => void;
  end: (reason?: Error) => Promise<void>;
}

function makeFakeProc(): {
  proc: {
    stdin: FakeFileSink;
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array> | null;
    exited: Promise<number>;
    kill: () => void;
  };
  killMock: ReturnType<typeof mock>;
  crash: () => void;
} {
  const stdout = new ReadableStream<Uint8Array>({});

  let exitResolve: ((code: number) => void) | null = null;
  const exited = new Promise<number>((resolve) => {
    exitResolve = resolve;
  });

  const killMock = mock(() => {});
  const kill = () => {
    killMock();
    exitResolve?.(0);
  };

  const crash = () => {
    exitResolve?.(1);
  };

  const stdin: FakeFileSink = {
    write: () => {},
    end: async () => {},
  };

  return {
    proc: { stdin, stdout, stderr: null, exited, kill },
    killMock,
    crash,
  };
}

describe("toolOpenCode server profile (ACP stdio)", () => {
  beforeEach(() => {
    serverRegistry.reset();
  });

  afterEach(async () => {
    await stopAllServers("test_end");
    opencodeInternals.resetSpawn();
    opencodeInternals.resetConnection();
  });

  it("requires an AgentFS container for server profile", async () => {
    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      execProfile: "server",
      prompt: "no-container",
      auto: "low",
    };

    let threw = false;
    try {
      await executeWithOpenCode({
        input,
        writer,
        signal: new AbortController().signal,
      });
    } catch (error: any) {
      threw = true;
      expect(String(error?.message ?? error)).toContain(
        "opencode_server_requires_container"
      );
    }
    expect(threw).toBe(true);
  });

  it("rejects containerCw outside /workspace", async () => {
    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      execProfile: "server",
      prompt: "bad-cwd",
      auto: "low",
      containerName: "alfred-agentfs-test",
      containerCw: "/tmp",
    };

    let threw = false;
    try {
      await executeWithOpenCode({
        input,
        writer,
        signal: new AbortController().signal,
      });
    } catch (error: any) {
      threw = true;
      expect(String(error?.message ?? error)).toContain(
        "opencode_container_cwd_invalid"
      );
    }
    expect(threw).toBe(true);
  });

  it("passes allowlisted env vars through docker exec", async () => {
    const fake = makeFakeProc();
    let argvSeen: string[] | undefined;

    const prevCerebras = process.env.CEREBRAS_API_KEY;
    const prevOpenCodeApiKey = process.env.OPENCODE_API_KEY;
    const prevConfig = process.env.OPENCODE_CONFIG_CONTENT;
    const prevDisableAutoUpdate = process.env.OPENCODE_DISABLE_AUTOUPDATE;

    process.env.CEREBRAS_API_KEY = "test-key";
    process.env.OPENCODE_API_KEY = "opencode-test-key";
    process.env.OPENCODE_CONFIG_CONTENT = '{"enabled_providers":["cerebras"]}';
    process.env.OPENCODE_DISABLE_AUTOUPDATE = "1";

    try {
      opencodeInternals.setSpawn((argv: any) => {
        argvSeen = Array.isArray(argv) ? (argv as string[]) : undefined;
        return fake.proc as any;
      });

      opencodeInternals.setConnection((factory) => ({
        initialize: async () => {},
        newSession: async () => ({ sessionId: "sess_1" }) as any,
        prompt: async (args: any) => {
          const client: any = factory();
          await client.sessionUpdate({
            sessionId: args.sessionId,
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "hello" },
            },
          });
          return {};
        },
        cancel: async () => {},
      }));

      const writer = { write: mock(() => {}) };
      const input: any = {
        action: "exec",
        prompt: "env",
        auto: "low",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      };

      const res = await executeWithOpenCode({
        input,
        writer,
        signal: new AbortController().signal,
      });

      expect(res.result).toBe("hello");
      expect(argvSeen).toBeTruthy();
      expect(argvSeen).toContain("-e");
      expect(argvSeen).toContain("CEREBRAS_API_KEY");
      expect(argvSeen).toContain("OPENCODE_API_KEY");
      expect(argvSeen).toContain("OPENCODE_CONFIG_CONTENT");
      expect(argvSeen).toContain("OPENCODE_DISABLE_AUTOUPDATE");
    } finally {
      if (prevCerebras === undefined) {
        process.env.CEREBRAS_API_KEY = undefined;
      } else {
        process.env.CEREBRAS_API_KEY = prevCerebras;
      }
      if (prevOpenCodeApiKey === undefined) {
        process.env.OPENCODE_API_KEY = undefined;
      } else {
        process.env.OPENCODE_API_KEY = prevOpenCodeApiKey;
      }
      if (prevConfig === undefined) {
        process.env.OPENCODE_CONFIG_CONTENT = undefined;
      } else {
        process.env.OPENCODE_CONFIG_CONTENT = prevConfig;
      }
      if (prevDisableAutoUpdate === undefined) {
        process.env.OPENCODE_DISABLE_AUTOUPDATE = undefined;
      } else {
        process.env.OPENCODE_DISABLE_AUTOUPDATE = prevDisableAutoUpdate;
      }
    }
  });

  it("starts once and reuses the server for multiple prompts", async () => {
    const fake = makeFakeProc();
    let spawns = 0;

    opencodeInternals.setSpawn(() => {
      spawns += 1;
      return fake.proc as any;
    });

    let sessionSeq = 0;
    opencodeInternals.setConnection((factory) => ({
      initialize: async () => {},
      newSession: async () => {
        sessionSeq += 1;
        return { sessionId: `sess_${sessionSeq}` } as any;
      },
      prompt: async (args: any) => {
        const client: any = factory();
        await client.sessionUpdate({
          sessionId: args.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "hello" },
          },
        });
        return {};
      },
      cancel: async () => {},
    }));

    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      prompt: "first",
      auto: "low",
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
    };

    const one = await executeWithOpenCode({
      input,
      writer,
      signal: new AbortController().signal,
    });
    expect(one.result).toBe("hello");

    input.prompt = "second";
    const two = await executeWithOpenCode({
      input,
      writer,
      signal: new AbortController().signal,
    });
    expect(two.result).toBe("hello");

    expect(spawns).toBe(1);

    await stopAllServers("stop");
    expect(fake.killMock).toHaveBeenCalledTimes(1);
  });

  it("restarts when the server crashes", async () => {
    const procs = [makeFakeProc(), makeFakeProc()];
    let spawns = 0;

    opencodeInternals.setSpawn(() => {
      const next = procs[spawns];
      spawns += 1;
      return next.proc as any;
    });

    opencodeInternals.setConnection((factory) => ({
      initialize: async () => {},
      newSession: async () => ({ sessionId: `sess_${spawns}` }) as any,
      prompt: async (args: any) => {
        const client: any = factory();
        await client.sessionUpdate({
          sessionId: args.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "hello" },
          },
        });
        return {};
      },
      cancel: async () => {},
    }));

    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      prompt: "first",
      auto: "low",
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
    };

    await executeWithOpenCode({
      input,
      writer,
      signal: new AbortController().signal,
    });

    procs[0]?.crash();
    await Promise.resolve();

    input.prompt = "second";
    const res = await executeWithOpenCode({
      input,
      writer,
      signal: new AbortController().signal,
    });
    expect(res.result).toBe("hello");
    expect(spawns).toBe(2);
  });

  it("propagates AbortSignal by issuing cancel()", async () => {
    const fake = makeFakeProc();
    opencodeInternals.setSpawn(() => fake.proc as any);

    let cancelCalls = 0;
    let resolvePrompt: (() => void) | null = null;

    opencodeInternals.setConnection(() => ({
      initialize: async () => {},
      newSession: async () => ({ sessionId: "sess_abort" }) as any,
      prompt: async () =>
        await new Promise<void>((resolve) => {
          resolvePrompt = resolve;
        }),
      cancel: async () => {
        cancelCalls += 1;
        resolvePrompt?.();
      },
    }));

    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      execProfile: "server",
      prompt: "hang",
      auto: "low",
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
    };

    const abort = new AbortController();
    const promise = executeWithOpenCode({
      input,
      writer,
      signal: abort.signal,
    });

    abort.abort();

    let threw = false;
    try {
      await promise;
    } catch (error: any) {
      threw = true;
      expect(String(error?.name ?? error)).toContain("Abort");
    }
    expect(threw).toBe(true);
    expect(cancelCalls).toBeGreaterThan(0);
  });
});

describe("opencode AgentFS env passthrough", () => {
  it("allows Cerebras API key into the container", () => {
    expect(__internals.dockerEnvAllowlist).toContain("CEREBRAS_API_KEY");
  });
});
