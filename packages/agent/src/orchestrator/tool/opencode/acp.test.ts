import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import {
  executeWithOpenCode,
  __internals as opencodeInternals,
} from "./exec.js";

type FakeFileSink = {
  write: (chunk: Uint8Array) => void;
  end: (reason?: Error) => Promise<void>;
};

function makeReadable(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let sent = false;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) {
        controller.close();
        return;
      }
      sent = true;
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function makeFakeProc(args?: {
  stdoutText?: string;
  exitCode?: number;
  onStdinText?: (text: string) => void;
}): {
  proc: {
    stdin: FakeFileSink;
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array> | null;
    exited: Promise<number>;
    kill: () => void;
  };
  stdinSeen: { value: string };
} {
  const stdinSeen = { value: "" };
  const sink: FakeFileSink = {
    write: (chunk) => {
      stdinSeen.value += new TextDecoder().decode(chunk);
    },
    end: () => {
      args?.onStdinText?.(stdinSeen.value);
      return Promise.resolve();
    },
  };

  const exitCode = args?.exitCode ?? 0;
  return {
    stdinSeen,
    proc: {
      stdin: sink,
      stdout: makeReadable(args?.stdoutText ?? ""),
      stderr: null,
      exited: Promise.resolve(exitCode),
      kill: () => {},
    },
  };
}

describe("toolOpenCode ACP client parity (filesystem + thought/plan/diff)", () => {
  const baseDir = path.join(
    process.cwd(),
    ".agent",
    "test-workspaces",
    "opencode-acp"
  );

  beforeEach(async () => {
    await fs.mkdir(baseDir, { recursive: true });
  });

  afterEach(() => {
    opencodeInternals.resetSpawn();
    opencodeInternals.resetConnection();
  });

  it("implements ACP readTextFile/writeTextFile in host mode", async () => {
    const cw = path.join(
      baseDir,
      `host-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    await fs.mkdir(cw, { recursive: true });

    opencodeInternals.setSpawn(() => makeFakeProc().proc as any);

    opencodeInternals.setConnection((factory) => ({
      initialize: async () => {},
      newSession: async () => ({ sessionId: "sess_fs" }) as any,
      prompt: async (args: any) => {
        const client: any = factory();
        await client.writeTextFile({
          sessionId: args.sessionId,
          path: "hello.txt",
          content: "hello",
        });
        const res = await client.readTextFile({
          sessionId: args.sessionId,
          path: "hello.txt",
        });
        expect(res.content).toBe("hello");
        return {};
      },
      cancel: async () => {},
    }));

    try {
      const out = await executeWithOpenCode({
        input: {
          action: "exec",
          prompt: "fs",
          auto: "low",
          cw,
        },
        writer: { write: mock(() => {}) },
        signal: new AbortController().signal,
      });

      const realCw = await fs.realpath(cw);
      const disk = await fs.readFile(path.join(realCw, "hello.txt"), "utf8");
      expect(disk).toBe("hello");
      expect(out.result).toBeDefined();
    } finally {
      await fs.rm(cw, { recursive: true, force: true });
    }
  });

  it("rejects filesystem access outside allowed prefixes in host mode", async () => {
    const cw = path.join(
      baseDir,
      `host-deny-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    await fs.mkdir(cw, { recursive: true });

    opencodeInternals.setSpawn(() => makeFakeProc().proc as any);

    opencodeInternals.setConnection((factory) => ({
      initialize: async () => {},
      newSession: async () => ({ sessionId: "sess_deny" }) as any,
      prompt: async (args: any) => {
        const client: any = factory();
        let threw = false;
        try {
          await client.readTextFile({
            sessionId: args.sessionId,
            path: "/tmp/should-not-read",
          });
        } catch (err: any) {
          threw = true;
          expect(String(err?.message ?? err)).toContain(
            "opencode_fs_path_disallowed"
          );
        }
        expect(threw).toBe(true);
        return {};
      },
      cancel: async () => {},
    }));

    try {
      await executeWithOpenCode({
        input: {
          action: "exec",
          prompt: "deny",
          auto: "low",
          cw,
        },
        writer: { write: mock(() => {}) },
        signal: new AbortController().signal,
      });
    } finally {
      await fs.rm(cw, { recursive: true, force: true });
    }
  });

  it("captures agent_thought_chunk + plan and surfaces diff content as artifacts", async () => {
    const cw = path.join(
      baseDir,
      `events-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    await fs.mkdir(cw, { recursive: true });

    opencodeInternals.setSpawn(() => makeFakeProc().proc as any);

    const writerChunks: unknown[] = [];
    const writer = {
      write: (chunk: unknown) => {
        writerChunks.push(chunk);
      },
    };

    opencodeInternals.setConnection((factory) => ({
      initialize: async () => {},
      newSession: async () => ({ sessionId: "sess_evt" }) as any,
      prompt: async (args: any) => {
        const client: any = factory();
        await client.sessionUpdate({
          sessionId: args.sessionId,
          update: {
            sessionUpdate: "agent_thought_chunk",
            content: { type: "text", text: "thinking..." },
          },
        });
        await client.sessionUpdate({
          sessionId: args.sessionId,
          update: {
            sessionUpdate: "plan",
            entries: [
              { content: "do thing", priority: "medium", status: "pending" },
            ],
          },
        });
        await client.sessionUpdate({
          sessionId: args.sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: "tc_1",
            status: "completed",
            content: [
              { type: "diff", path: "file.txt", oldText: "", newText: "x" },
            ],
          },
        });
        await client.sessionUpdate({
          sessionId: args.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "done" },
          },
        });
        return {};
      },
      cancel: async () => {},
    }));

    try {
      const out = await executeWithOpenCode({
        input: {
          action: "exec",
          prompt: "events",
          auto: "low",
          cw,
        },
        writer,
        signal: new AbortController().signal,
      });

      expect(out.artifacts?.some((a) => a.path === "file.txt")).toBe(true);
      expect(
        writerChunks.some(
          (c: any) => c?.type === "stdout" && c?.event?.type === "thought"
        )
      ).toBe(true);
      expect(
        writerChunks.some(
          (c: any) => c?.type === "notice" && c?.message === "opencode_plan"
        )
      ).toBe(true);
      expect(
        writerChunks.some(
          (c: any) => c?.type === "stdout" && c?.event?.type === "artifact"
        )
      ).toBe(true);
    } finally {
      await fs.rm(cw, { recursive: true, force: true });
    }
  });

  it("proxies ACP filesystem ops through docker exec when containerName is set", async () => {
    const calls: Array<{ argv: string[]; stdin?: string }> = [];
    const catOut = makeFakeProc({ stdoutText: "hi" });
    const teeIn = makeFakeProc({
      onStdinText: (text) => {
        // record stdin content written to tee
        calls.push({ argv: ["<tee-stdin>"], stdin: text });
      },
    });

    opencodeInternals.setSpawn((argv: any) => {
      const a = Array.isArray(argv) ? (argv as string[]) : [];
      calls.push({ argv: a });
      // backend spawn includes "-w"; docker fs ops do not.
      if (a.includes("-w")) {
        return makeFakeProc().proc as any;
      }
      const cmd = a.slice(4).join(" ");
      if (cmd.startsWith("mkdir -p")) {
        return makeFakeProc().proc as any;
      }
      if (cmd.startsWith("tee ")) {
        return teeIn.proc as any;
      }
      if (cmd.startsWith("cat ")) {
        return catOut.proc as any;
      }
      return makeFakeProc().proc as any;
    });

    opencodeInternals.setConnection((factory) => ({
      initialize: async () => {},
      newSession: async () => ({ sessionId: "sess_docker" }) as any,
      prompt: async (args: any) => {
        const client: any = factory();
        await client.writeTextFile({
          sessionId: args.sessionId,
          path: "x.txt",
          content: "hello",
        });
        const res = await client.readTextFile({
          sessionId: args.sessionId,
          path: "x.txt",
        });
        expect(res.content).toBe("hi");
        return {};
      },
      cancel: async () => {},
    }));

    await executeWithOpenCode({
      input: {
        action: "exec",
        prompt: "docker-fs",
        auto: "low",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      },
      writer: { write: mock(() => {}) },
      signal: new AbortController().signal,
    });

    expect(calls.some((c) => c.argv.join(" ").includes("docker exec -i"))).toBe(
      true
    );
    expect(calls.some((c) => c.stdin === "hello")).toBe(true);
  });
});
