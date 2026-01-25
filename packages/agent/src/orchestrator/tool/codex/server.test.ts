import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  __internals as serverRegistry,
  stopAllServers,
} from "../shared/server.js";
import {
  __internals as codexServerInternals,
  executeWithCodexServer,
} from "./server.ts";

const realSpawn = Bun.spawn;

interface SpawnResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr?: string;
}

function setSpawnMock(map: Record<string, SpawnResult>): string[] {
  const calls: string[] = [];
  Bun.spawn = ((argv: readonly string[]) => {
    const cmd = argv.at(-1);
    if (!cmd) {
      throw new Error("hook_test_missing_command");
    }
    calls.push(cmd);
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

  return calls;
}

interface FakeFileSink {
  write: (chunk: Uint8Array) => void;
  end: () => Promise<void>;
}

function makeFakeProc(args?: {
  holdComplete?: boolean;
  onTurnStart?: (info: {
    send: (value: unknown) => void;
    threadId: string;
    turnId: string;
  }) => void;
}): {
  proc: {
    stdin: FakeFileSink;
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array> | null;
    exited: Promise<number>;
    kill: () => void;
  };
  sent: unknown[];
  killMock: ReturnType<typeof mock>;
  crash: () => void;
} {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const sent: unknown[] = [];

  let stdoutCtrl: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      stdoutCtrl = controller;
    },
  });

  const send = (value: unknown) => {
    stdoutCtrl?.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
  };

  let exitResolve: ((code: number) => void) | null = null;
  const exited = new Promise<number>((resolve) => {
    exitResolve = resolve;
  });

  const killMock = mock(() => {});
  const kill = () => {
    killMock();
    try {
      stdoutCtrl?.close();
    } catch {
      // ignore
    }
    exitResolve?.(0);
  };

  const threadId = "thr_1";
  let turnSeq = 0;
  const holdComplete = args?.holdComplete === true;
  const pendingCompletions = new Map<string, string>(); // turnId -> threadId

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      return;
    }
    const msg = JSON.parse(trimmed) as any;
    sent.push(msg);

    if (msg.method === "initialized") {
      return;
    }

    if (msg.method === "initialize" && typeof msg.id === "number") {
      send({ id: msg.id, result: { userAgent: "test" } });
      return;
    }

    if (msg.method === "thread/start" && typeof msg.id === "number") {
      send({ id: msg.id, result: { thread: { id: threadId } } });
      return;
    }

    if (msg.method === "turn/start" && typeof msg.id === "number") {
      turnSeq += 1;
      const turnId = `turn_${turnSeq}`;
      send({ id: msg.id, result: { turn: { id: turnId } } });

      queueMicrotask(() => {
        args?.onTurnStart?.({ send, threadId, turnId });
        send({
          method: "item/agentMessage/delta",
          params: {
            threadId,
            turnId,
            itemId: `itm_${turnSeq}`,
            delta: "hello",
          },
        });
        if (holdComplete) {
          pendingCompletions.set(turnId, threadId);
          return;
        }
        send({
          method: "turn/completed",
          params: { threadId, turn: { id: turnId, status: "completed" } },
        });
      });
      return;
    }

    if (msg.method === "turn/interrupt" && typeof msg.id === "number") {
      const params = msg.params ?? {};
      const turnId = typeof params.turnId === "string" ? params.turnId : "";
      const tid =
        typeof params.threadId === "string" ? params.threadId : threadId;
      send({ id: msg.id, result: {} });

      queueMicrotask(() => {
        const shouldComplete = pendingCompletions.has(turnId);
        if (!shouldComplete) {
          return;
        }
        pendingCompletions.delete(turnId);
        send({
          method: "turn/completed",
          params: {
            threadId: tid,
            turn: { id: turnId, status: "interrupted" },
          },
        });
      });
      return;
    }

    if (typeof msg.id === "number" && typeof msg.method === "string") {
      send({ id: msg.id, error: { message: "unknown_method" } });
    }
  };

  let buffer = "";
  const stdin: FakeFileSink = {
    write: (chunk) => {
      buffer += decoder.decode(chunk, { stream: true });
      while (true) {
        const idx = buffer.indexOf("\n");
        if (idx === -1) {
          break;
        }
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.trim().length === 0) {
          continue;
        }
        handleLine(line);
      }
    },
    end: async () => {},
  };

  const crash = () => {
    try {
      stdoutCtrl?.close();
    } catch {
      // ignore
    }
    exitResolve?.(1);
  };

  return {
    proc: { stdin, stdout, stderr: null, exited, kill },
    sent,
    killMock,
    crash,
  };
}

function makeCwdHandle(dir = "/tmp") {
  return {
    path: dir,
    fd: 0,
    close: () => {},
  };
}

describe("toolCodex server profile (app-server)", () => {
  beforeEach(() => {
    serverRegistry.reset();
  });

  afterEach(async () => {
    await stopAllServers("test_end");
    codexServerInternals.resetSpawn();
    Bun.spawn = realSpawn;
  });

  it("spawns docker exec with -i for stdin piping", async () => {
    const binDir = await mkdtemp(path.join(tmpdir(), "alfred-codex-docker-"));
    const prevPath = process.env.PATH;
    try {
      await writeFile(
        path.join(binDir, "docker"),
        "#!/bin/sh\nexit 0\n",
        "utf8"
      );
      await chmod(path.join(binDir, "docker"), 0o755);
      process.env.PATH = `${binDir}${path.delimiter}${prevPath ?? ""}`;

      const fake = makeFakeProc();
      let spawnArgs: any = null;
      codexServerInternals.setSpawn((args: any) => {
        spawnArgs = args;
        return fake.proc as any;
      });

      const writer = { write: mock(() => {}) };
      const input: any = {
        action: "exec",
        execProfile: "server",
        prompt: "noop",
        out: "text",
        auto: "low",
        cw: "/tmp",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      };

      await executeWithCodexServer({
        input,
        writer,
        cwdHandle: makeCwdHandle() as any,
      });

      expect(Array.isArray(spawnArgs?.args)).toBe(true);
      expect(spawnArgs.args).toContain("exec");
      expect(spawnArgs.args).toContain("-i");
    } finally {
      process.env.PATH = prevPath;
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it("requires an AgentFS container for server profile", async () => {
    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      execProfile: "server",
      prompt: "no-container",
      out: "text",
      auto: "low",
      cw: "/tmp",
      containerCw: "/workspace",
    };

    let threw = false;
    try {
      await executeWithCodexServer({
        input,
        writer,
        cwdHandle: makeCwdHandle() as any,
      });
    } catch (error: any) {
      threw = true;
      expect(String(error?.message ?? error)).toContain(
        "codex_server_requires_container"
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
      out: "text",
      auto: "low",
      cw: "/tmp",
      containerName: "alfred-agentfs-test",
      containerCw: "/etc",
    };

    let threw = false;
    try {
      await executeWithCodexServer({
        input,
        writer,
        cwdHandle: makeCwdHandle() as any,
      });
    } catch (error: any) {
      threw = true;
      expect(String(error?.message ?? error)).toContain(
        "codex_container_cwd_invalid"
      );
    }
    expect(threw).toBe(true);
  });

  it("starts once and reuses the server for multiple prompts", async () => {
    const fake = makeFakeProc();
    let spawns = 0;
    codexServerInternals.setSpawn(() => {
      spawns += 1;
      return fake.proc as any;
    });

    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      execProfile: "server",
      prompt: "first",
      out: "text",
      auto: "low",
      cw: "/tmp",
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
    };

    const one = await executeWithCodexServer({
      input,
      writer,
      signal: new AbortController().signal,
      cwdHandle: makeCwdHandle() as any,
    });
    expect(one.result).toBe("hello");

    input.prompt = "second";
    const two = await executeWithCodexServer({
      input,
      writer,
      signal: new AbortController().signal,
      cwdHandle: makeCwdHandle() as any,
    });
    expect(two.result).toBe("hello");

    expect(spawns).toBe(1);

    await stopAllServers("stop");
    expect(fake.killMock).toHaveBeenCalledTimes(1);
  });

  it("restarts when the server crashes", async () => {
    const procs = [makeFakeProc(), makeFakeProc()];
    let spawns = 0;
    codexServerInternals.setSpawn(() => {
      const next = procs[spawns];
      spawns += 1;
      return next.proc as any;
    });

    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      execProfile: "server",
      prompt: "first",
      out: "text",
      auto: "low",
      cw: "/tmp",
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
    };

    await executeWithCodexServer({
      input,
      writer,
      signal: new AbortController().signal,
      cwdHandle: makeCwdHandle() as any,
    });

    // Simulate server exit before next prompt.
    procs[0].crash();
    await Promise.resolve();

    input.prompt = "second";
    const res = await executeWithCodexServer({
      input,
      writer,
      signal: new AbortController().signal,
      cwdHandle: makeCwdHandle() as any,
    });
    expect(res.result).toBe("hello");
    expect(spawns).toBe(2);
  });

  it("gates execCommandApproval via hooks.json when present", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "alfred-codex-hooks-"));
    try {
      await writeFile(
        path.join(dir, "hooks.json"),
        JSON.stringify({
          version: 1,
          hooks: {
            "agent:shell:before": [{ command: "allow" }],
          },
        })
      );

      expect(await Bun.file(path.join(dir, "hooks.json")).exists()).toBe(true);

      const calls = setSpawnMock({
        allow: { exitCode: 0, stdout: JSON.stringify({ decision: "allow" }) },
      });

      const approvalId = 123;
      const fake = makeFakeProc({
        onTurnStart: ({ send }) => {
          send({
            id: approvalId,
            method: "execCommandApproval",
            params: { command: "echo hello" },
          });
        },
      });
      codexServerInternals.setSpawn(() => fake.proc as any);

      const writer = { write: mock(() => {}) };
      const input: any = {
        action: "exec",
        execProfile: "server",
        prompt: "hello",
        out: "text",
        auto: "read",
        cw: dir,
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      };

      await executeWithCodexServer({
        input,
        writer,
        cwdHandle: makeCwdHandle(dir) as any,
      });

      expect(calls).toContain("allow");

      let resp: any;
      for (let i = 0; i < 20; i++) {
        resp = fake.sent.find(
          (m: any) => m && typeof m === "object" && m.id === approvalId
        );
        if (resp) {
          break;
        }
        await Promise.resolve();
      }

      expect(resp?.result?.decision?.type).toBe("approved");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("gates applyPatchApproval via hooks.json when present", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "alfred-codex-hooks-"));
    try {
      await writeFile(
        path.join(dir, "hooks.json"),
        JSON.stringify({
          version: 1,
          hooks: {
            "agent:file:before": [{ command: "allow" }],
          },
        })
      );

      expect(await Bun.file(path.join(dir, "hooks.json")).exists()).toBe(true);

      const calls = setSpawnMock({
        allow: { exitCode: 0, stdout: JSON.stringify({ decision: "allow" }) },
      });

      const approvalId = 456;
      const patch =
        "*** Begin Patch\n*** Update File: /tmp/a.txt\n@@\n- a\n+ b\n*** End Patch";

      const fake = makeFakeProc({
        onTurnStart: ({ send }) => {
          send({
            id: approvalId,
            method: "applyPatchApproval",
            params: { patch },
          });
        },
      });
      codexServerInternals.setSpawn(() => fake.proc as any);

      const writer = { write: mock(() => {}) };
      const input: any = {
        action: "exec",
        execProfile: "server",
        prompt: "hello",
        out: "text",
        auto: "read",
        cw: dir,
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      };

      await executeWithCodexServer({
        input,
        writer,
        cwdHandle: makeCwdHandle(dir) as any,
      });

      expect(calls).toContain("allow");

      let resp: any;
      for (let i = 0; i < 20; i++) {
        resp = fake.sent.find(
          (m: any) => m && typeof m === "object" && m.id === approvalId
        );
        if (resp) {
          break;
        }
        await Promise.resolve();
      }

      expect(resp?.result?.decision?.type).toBe("approved");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("propagates AbortSignal by issuing turn/interrupt", async () => {
    const fake = makeFakeProc({ holdComplete: true });
    codexServerInternals.setSpawn(() => fake.proc as any);

    const writer = { write: mock(() => {}) };
    const input: any = {
      action: "exec",
      execProfile: "server",
      prompt: "hang",
      out: "text",
      auto: "low",
      cw: "/tmp",
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
    };

    const abort = new AbortController();
    const promise = executeWithCodexServer({
      input,
      writer,
      signal: abort.signal,
      cwdHandle: makeCwdHandle() as any,
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

    expect(
      fake.sent.some(
        (m: any) => m && typeof m === "object" && m.method === "turn/interrupt"
      )
    ).toBe(true);
  });
});
