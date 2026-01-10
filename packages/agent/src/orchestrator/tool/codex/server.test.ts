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
} from "./server.js";

type FakeFileSink = {
  write: (chunk: Uint8Array) => void;
  end: () => Promise<void>;
};

function makeFakeProc(args?: { holdComplete?: boolean }): {
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
        if (idx < 0) {
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

function makeCwdHandle() {
  return {
    path: "/tmp",
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
    } catch (err: any) {
      threw = true;
      expect(String(err?.message ?? err)).toContain(
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
    } catch (err: any) {
      threw = true;
      expect(String(err?.message ?? err)).toContain(
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
    } catch (err: any) {
      threw = true;
      expect(String(err?.name ?? err)).toContain("Abort");
    }
    expect(threw).toBe(true);

    expect(
      fake.sent.some(
        (m: any) => m && typeof m === "object" && m.method === "turn/interrupt"
      )
    ).toBe(true);
  });
});
