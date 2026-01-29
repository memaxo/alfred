import { afterEach, describe, expect, it } from "bun:test";

import { __internals as registryInternals } from "../shared/server.js";
import { __internals as fetchInternals } from "./fetch.js";
import {
  executeWithOpenCodeHttp,
  __internals as httpInternals,
} from "./http.js";
import { __internals as serverInternals } from "./server.js";

interface FakeFileSink {
  write: (chunk: Uint8Array) => void;
  end: (reason?: Error) => Promise<void>;
}

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

function makeFakeProc(args: {
  stdoutText?: string;
  stderrText?: string;
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
    end: () => {
      args.onStdinText?.(stdinSeen.value);
      return Promise.resolve();
    },
    write: (chunk) => {
      stdinSeen.value += new TextDecoder().decode(chunk);
    },
  };

  return {
    proc: {
      stdin: sink,
      stdout: makeReadable(args.stdoutText ?? ""),
      stderr: args.stderrText ? makeReadable(args.stderrText) : null,
      exited: Promise.resolve(args.exitCode ?? 0),
      kill: () => {},
    },
    stdinSeen,
  };
}

function httpResponse(args: {
  status: number;
  body?: unknown;
  contentType?: string;
}): string {
  const ct = args.contentType ?? "application/json";
  const body =
    args.body === undefined
      ? ""
      : typeof args.body === "string"
        ? args.body
        : JSON.stringify(args.body);
  const statusText =
    args.status === 200 ? "OK" : args.status === 204 ? "No Content" : "";
  const headers =
    args.status === 204
      ? `HTTP/1.1 204 ${statusText}\r\n\r\n`
      : `HTTP/1.1 ${args.status} ${statusText}\r\ncontent-type: ${ct}\r\n\r\n`;
  return `${headers}${body}`;
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

describe("toolOpenCode HTTP transport (OpenCode server + SDK)", () => {
  afterEach(() => {
    registryInternals.reset();
    fetchInternals.resetSpawn();
    serverInternals.resetSpawn();
    httpInternals.resetSpawn();
    httpInternals.resetIdFactory();
  });

  it("streams message parts, registers MCP servers, and returns result", async () => {
    const calls: string[][] = [];
    const fixedUuid = "00000000-0000-0000-0000-000000000000";
    httpInternals.setIdFactory(() => fixedUuid);
    const messageId = `alfred_${fixedUuid.replaceAll("-", "")}`;

    const sessionId = "sess_1";

    const sse =
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: {
            part: {
              id: "p1",
              sessionID: sessionId,
              messageID: messageId,
              type: "text",
              text: "hi",
            },
            delta: "hi",
          },
          type: "message.part.updated",
        },
      }) +
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: {
            sessionID: sessionId,
            todos: [
              {
                id: "t1",
                content: "do thing",
                status: "pending",
                priority: "medium",
              },
            ],
          },
          type: "todo.updated",
        },
      }) +
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: {
            sessionID: sessionId,
            diff: [{ file: "x.txt", type: "create" }],
          },
          type: "session.diff",
        },
      }) +
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: { sessionID: sessionId },
          type: "session.idle",
        },
      });

    const spawnMock = ((argv: string[]) => {
      const a = [...argv];
      calls.push(a);

      if (a.includes("opencode") && a.includes("serve")) {
        return makeFakeProc({ exitCode: 0, stdoutText: "" }).proc as any;
      }

      if (a.includes("pkill")) {
        return makeFakeProc({ exitCode: 0, stdoutText: "" }).proc as any;
      }

      const url = a.at(-1) ?? "";
      if (
        typeof url === "string" &&
        url.includes("/global/event") &&
        a.includes("-N")
      ) {
        return makeFakeProc({ exitCode: 0, stdoutText: sse }).proc as any;
      }

      if (typeof url === "string" && url.includes("/path")) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              state: "ok",
              config: "ok",
              worktree: "ok",
              directory: "/workspace",
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.endsWith("/session") &&
        a.includes("--request") &&
        a.includes("POST")
      ) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              id: sessionId,
              projectID: "p",
              directory: "/workspace",
              title: "t",
              version: "v",
              time: { created: 0, updated: 0 },
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.includes(`/session/${sessionId}/prompt_async`)
      ) {
        return makeFakeProc({
          exitCode: 0,
          stdoutText: httpResponse({ status: 204 }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.includes(`/session/${sessionId}/message/${messageId}`)
      ) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              info: {
                id: messageId,
                sessionID: sessionId,
                role: "assistant",
                parentID: "u",
                modelID: "m",
                providerID: "p",
                mode: "read",
                path: { cwd: "/workspace", root: "/workspace" },
                cost: 0,
                tokens: {
                  input: 0,
                  output: 0,
                  reasoning: 0,
                  cache: { read: 0, write: 0 },
                },
                time: { created: 0 },
              },
              parts: [
                {
                  id: "p1",
                  sessionID: sessionId,
                  messageID: messageId,
                  type: "text",
                  text: "hi",
                },
              ],
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (typeof url === "string" && url.endsWith("/mcp")) {
        return makeFakeProc({
          stdoutText: httpResponse({ body: {}, status: 200 }),
        }).proc as any;
      }

      if (typeof url === "string" && url.endsWith("/instance/dispose")) {
        return makeFakeProc({
          stdoutText: httpResponse({ body: true, status: 200 }),
        }).proc as any;
      }

      return makeFakeProc({
        stdoutText: httpResponse({ body: {}, status: 200 }),
      }).proc as any;
    }) as any;

    fetchInternals.setSpawn(spawnMock);
    serverInternals.setSpawn(spawnMock);
    httpInternals.setSpawn(spawnMock);

    const chunks: unknown[] = [];
    const writer = { write: (c: unknown) => chunks.push(c) };

    const out = await executeWithOpenCodeHttp({
      input: {
        action: "exec",
        transport: "http",
        execProfile: "server",
        prompt: "hi",
        auto: "low",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
        mcpServers: [
          {
            name: "alfred_runtime",
            url: "http://example.com/mcp",
            headers: [{ name: "authorization", value: "Bearer t" }],
          },
        ],
      },
      signal: new AbortController().signal,
      writer,
    } as any);

    expect(out.result).toBe("hi");
    expect(out.artifacts?.some((a) => a.path === "x.txt")).toBe(true);
    expect(
      chunks.some(
        (c: any) =>
          c?.type === "stdout" &&
          c?.event?.type === "output" &&
          c?.event?.content === "hi"
      )
    ).toBe(true);
    expect(
      chunks.some(
        (c: any) => c?.type === "notice" && c?.message === "opencode_plan"
      )
    ).toBe(true);
    expect(calls.some((a) => a.join(" ").includes("/mcp"))).toBe(true);
  });

  it("reuses the shared server + session mapping for execProfile=server", async () => {
    const calls: string[][] = [];

    const uuids = [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
    ];
    let idIdx = 0;
    httpInternals.setIdFactory(() => uuids[idIdx++] ?? uuids[1]!);

    const sessionKey = "alfred_session";
    const sessionId = "sess_1";
    const messageId1 = `alfred_${uuids[0]!.replaceAll("-", "")}`;
    const messageId2 = `alfred_${uuids[1]!.replaceAll("-", "")}`;

    const sse1 =
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: {
            part: {
              id: "p1",
              sessionID: sessionId,
              messageID: messageId1,
              type: "text",
              text: "hi",
            },
            delta: "hi",
          },
          type: "message.part.updated",
        },
      }) +
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: { sessionID: sessionId },
          type: "session.idle",
        },
      });

    const sse2 =
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: {
            part: {
              id: "p1",
              sessionID: sessionId,
              messageID: messageId2,
              type: "text",
              text: "yo",
            },
            delta: "yo",
          },
          type: "message.part.updated",
        },
      }) +
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: { sessionID: sessionId },
          type: "session.idle",
        },
      });

    const sseQueue = [sse1, sse2];

    const spawnMock = ((argv: string[]) => {
      const a = [...argv];
      calls.push(a);

      if (a.includes("opencode") && a.includes("serve")) {
        return makeFakeProc({ exitCode: 0, stdoutText: "" }).proc as any;
      }

      if (a.includes("pkill")) {
        return makeFakeProc({ exitCode: 0, stdoutText: "" }).proc as any;
      }

      const url = a.at(-1) ?? "";
      if (
        typeof url === "string" &&
        url.includes("/global/event") &&
        a.includes("-N")
      ) {
        return makeFakeProc({ exitCode: 0, stdoutText: sseQueue.shift() })
          .proc as any;
      }

      if (typeof url === "string" && url.includes("/path")) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              state: "ok",
              config: "ok",
              worktree: "ok",
              directory: "/workspace",
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.endsWith("/session") &&
        a.includes("--request") &&
        a.includes("POST")
      ) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              id: sessionId,
              projectID: "p",
              directory: "/workspace",
              title: "t",
              version: "v",
              time: { created: 0, updated: 0 },
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.includes(`/session/${sessionId}/prompt_async`)
      ) {
        return makeFakeProc({
          exitCode: 0,
          stdoutText: httpResponse({ status: 204 }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.includes(`/session/${sessionId}/message/${messageId1}`)
      ) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              info: {
                id: messageId1,
                sessionID: sessionId,
                role: "assistant",
                parentID: "u",
                modelID: "m",
                providerID: "p",
                mode: "read",
                path: { cwd: "/workspace", root: "/workspace" },
                cost: 0,
                tokens: {
                  input: 0,
                  output: 0,
                  reasoning: 0,
                  cache: { read: 0, write: 0 },
                },
                time: { created: 0 },
              },
              parts: [
                {
                  id: "p1",
                  sessionID: sessionId,
                  messageID: messageId1,
                  type: "text",
                  text: "hi",
                },
              ],
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.includes(`/session/${sessionId}/message/${messageId2}`)
      ) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              info: {
                id: messageId2,
                sessionID: sessionId,
                role: "assistant",
                parentID: "u",
                modelID: "m",
                providerID: "p",
                mode: "read",
                path: { cwd: "/workspace", root: "/workspace" },
                cost: 0,
                tokens: {
                  input: 0,
                  output: 0,
                  reasoning: 0,
                  cache: { read: 0, write: 0 },
                },
                time: { created: 0 },
              },
              parts: [
                {
                  id: "p1",
                  sessionID: sessionId,
                  messageID: messageId2,
                  type: "text",
                  text: "yo",
                },
              ],
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (typeof url === "string" && url.endsWith("/instance/dispose")) {
        return makeFakeProc({
          stdoutText: httpResponse({ body: true, status: 200 }),
        }).proc as any;
      }

      return makeFakeProc({
        stdoutText: httpResponse({ body: {}, status: 200 }),
      }).proc as any;
    }) as any;

    fetchInternals.setSpawn(spawnMock);
    serverInternals.setSpawn(spawnMock);
    httpInternals.setSpawn(spawnMock);

    const out1 = await executeWithOpenCodeHttp({
      input: {
        action: "exec",
        transport: "http",
        execProfile: "server",
        prompt: "hi",
        auto: "low",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
        sessionId: sessionKey,
      },
      signal: new AbortController().signal,
      writer: { write: () => {} },
    } as any);

    const out2 = await executeWithOpenCodeHttp({
      input: {
        action: "exec",
        transport: "http",
        execProfile: "server",
        prompt: "yo",
        auto: "low",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
        sessionId: sessionKey,
      },
      signal: new AbortController().signal,
      writer: { write: () => {} },
    } as any);

    expect(out1.result).toBe("hi");
    expect(out2.result).toBe("yo");

    expect(
      calls.filter((a) => a.includes("opencode") && a.includes("serve")).length
    ).toBe(1);
    expect(
      calls.filter(
        (a) =>
          a.at(-1)?.toString().endsWith("/session") &&
          a.includes("--request") &&
          a.includes("POST")
      ).length
    ).toBe(1);
  });

  it("restarts the shared server when unhealthy", async () => {
    const calls: string[][] = [];

    const fixedUuid = "00000000-0000-0000-0000-000000000000";
    httpInternals.setIdFactory(() => fixedUuid);
    const messageId = `alfred_${fixedUuid.replaceAll("-", "")}`;

    const sessionKey = "alfred_session";
    const sessionId = "sess_1";

    const sse =
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: {
            part: {
              id: "p1",
              sessionID: sessionId,
              messageID: messageId,
              type: "text",
              text: "hi",
            },
            delta: "hi",
          },
          type: "message.part.updated",
        },
      }) +
      sseEvent({
        directory: "/workspace",
        payload: {
          properties: { sessionID: sessionId },
          type: "session.idle",
        },
      });

    let pathCalls = 0;
    const spawnMock = ((argv: string[]) => {
      const a = [...argv];
      calls.push(a);

      if (a.includes("opencode") && a.includes("serve")) {
        return makeFakeProc({ exitCode: 0, stdoutText: "" }).proc as any;
      }

      if (a.includes("pkill")) {
        return makeFakeProc({ exitCode: 0, stdoutText: "" }).proc as any;
      }

      const url = a.at(-1) ?? "";

      if (
        typeof url === "string" &&
        url.includes("/global/event") &&
        a.includes("-N")
      ) {
        return makeFakeProc({ exitCode: 0, stdoutText: sse }).proc as any;
      }

      if (typeof url === "string" && url.includes("/path")) {
        pathCalls++;

        // 1) initial waitForReady: ok
        // 2) ensureServer healthy check: fail => restart
        // 3) restart waitForReady: ok
        if (pathCalls === 2) {
          return makeFakeProc({
            exitCode: 0,
            stdoutText: httpResponse({ status: 500, body: {} }),
          }).proc as any;
        }

        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              state: "ok",
              config: "ok",
              worktree: "ok",
              directory: "/workspace",
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.endsWith("/session") &&
        a.includes("--request") &&
        a.includes("POST")
      ) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              id: sessionId,
              projectID: "p",
              directory: "/workspace",
              title: "t",
              version: "v",
              time: { created: 0, updated: 0 },
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.includes(`/session/${sessionId}/prompt_async`)
      ) {
        return makeFakeProc({
          exitCode: 0,
          stdoutText: httpResponse({ status: 204 }),
        }).proc as any;
      }

      if (
        typeof url === "string" &&
        url.includes(`/session/${sessionId}/message/${messageId}`)
      ) {
        return makeFakeProc({
          stdoutText: httpResponse({
            body: {
              info: {
                id: messageId,
                sessionID: sessionId,
                role: "assistant",
                parentID: "u",
                modelID: "m",
                providerID: "p",
                mode: "read",
                path: { cwd: "/workspace", root: "/workspace" },
                cost: 0,
                tokens: {
                  input: 0,
                  output: 0,
                  reasoning: 0,
                  cache: { read: 0, write: 0 },
                },
                time: { created: 0 },
              },
              parts: [
                {
                  id: "p1",
                  sessionID: sessionId,
                  messageID: messageId,
                  type: "text",
                  text: "hi",
                },
              ],
            },
            status: 200,
          }),
        }).proc as any;
      }

      if (typeof url === "string" && url.endsWith("/instance/dispose")) {
        return makeFakeProc({
          stdoutText: httpResponse({ body: true, status: 200 }),
        }).proc as any;
      }

      return makeFakeProc({
        stdoutText: httpResponse({ body: {}, status: 200 }),
      }).proc as any;
    }) as any;

    fetchInternals.setSpawn(spawnMock);
    serverInternals.setSpawn(spawnMock);
    httpInternals.setSpawn(spawnMock);

    await executeWithOpenCodeHttp({
      input: {
        action: "exec",
        transport: "http",
        execProfile: "server",
        prompt: "hi",
        auto: "low",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
        sessionId: sessionKey,
      },
      signal: new AbortController().signal,
      writer: { write: () => {} },
    } as any);

    await executeWithOpenCodeHttp({
      input: {
        action: "exec",
        transport: "http",
        execProfile: "server",
        prompt: "hi",
        auto: "low",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
        sessionId: sessionKey,
      },
      signal: new AbortController().signal,
      writer: { write: () => {} },
    } as any);

    expect(
      calls.filter((a) => a.includes("opencode") && a.includes("serve")).length
    ).toBe(2);
    expect(
      calls.some((a) => a.at(-1)?.toString().endsWith("/instance/dispose"))
    ).toBe(true);
  });
});
