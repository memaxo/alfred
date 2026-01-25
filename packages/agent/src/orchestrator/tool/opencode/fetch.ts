import type { FileSink } from "bun";

import { logger } from "@alfred/logger";
import { spawn } from "bun";

type SpawnProc = typeof spawn;

const AGENTFS_CONTAINER_PREFIX = "alfred-agentfs-";

let spawnProc: SpawnProc = spawn;

function assertAgentfsContainerName(containerName: string): void {
  if (!containerName.startsWith(AGENTFS_CONTAINER_PREFIX)) {
    throw new Error("opencode_container_name_invalid");
  }
}

function basicAuth(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64"
  );
  return `Basic ${token}`;
}

function isSseRequest(req: Request): boolean {
  const accept = req.headers.get("accept")?.toLowerCase() ?? "";
  if (accept.includes("text/event-stream")) {
    return true;
  }
  try {
    const p = new URL(req.url).pathname;
    return p.endsWith("/event") || p.endsWith("/global/event");
  } catch {
    return req.url.endsWith("/event") || req.url.endsWith("/global/event");
  }
}

async function drain(stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) {
    return;
  }
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) {
        return;
      }
    }
  } catch {
    // ignore
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

async function readRequestBody(req: Request): Promise<Uint8Array | undefined> {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD") {
    return;
  }
  if (!req.body) {
    return;
  }
  const buf = await req.clone().arrayBuffer();
  return new Uint8Array(buf);
}

function parseCurlHttpResponse(raw: string): {
  status: number;
  headers: Headers;
  body: string;
} {
  const sep = raw.includes("\r\n\r\n") ? "\r\n\r\n" : "\n\n";
  const idx = raw.indexOf(sep);
  if (idx === -1) {
    return { body: raw, headers: new Headers(), status: 200 };
  }

  const headerText = raw.slice(0, idx);
  const body = raw.slice(idx + sep.length);
  const lines = headerText.split(/\r?\n/).filter(Boolean);
  const statusLine = lines[0] ?? "";
  const m = statusLine.match(/HTTP\/\d+(?:\.\d+)?\s+(\d+)/);
  const status = m ? Number(m[1]) : 200;

  const headers = new Headers();
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(":");
    if (colon <= 0) {
      continue;
    }
    const k = line.slice(0, colon).trim();
    const v = line.slice(colon + 1).trim();
    if (k) {
      headers.append(k, v);
    }
  }

  return { body, headers, status };
}

async function dockerExecCurl(args: {
  containerName: string;
  url: string;
  method: string;
  headers: Headers;
  body: Uint8Array | undefined;
  signal: AbortSignal | null;
}): Promise<Response> {
  assertAgentfsContainerName(args.containerName);

  const curlArgs: string[] = [
    "curl",
    "-sS",
    "-i",
    "--max-time",
    "30",
    "--request",
    args.method,
    "-H",
    "accept-encoding: identity",
  ];

  for (const [k, v] of args.headers.entries()) {
    if (k.toLowerCase() === "host") {
      continue;
    }
    curlArgs.push("-H", `${k}: ${v}`);
  }

  if (args.body && args.body.length > 0) {
    curlArgs.push("--data-binary", "@-");
  }

  curlArgs.push(args.url);

  const proc = spawnProc(
    ["docker", "exec", "-i", args.containerName, ...curlArgs],
    {
      env: process.env,
      stderr: "pipe",
      stdin: "pipe",
      stdout: "pipe",
    }
  );

  const abortHandler = () => {
    try {
      proc.kill();
    } catch {
      // ignore
    }
  };

  if (args.signal) {
    if (args.signal.aborted) {
      abortHandler();
      throw new DOMException("Aborted", "AbortError");
    }
    args.signal.addEventListener("abort", abortHandler, { once: true });
  }

  try {
    if (!proc.stdin || typeof proc.stdin === "number") {
      proc.kill();
      throw new Error("opencode_stdin_unavailable");
    }

    if (args.body && args.body.length > 0) {
      (proc.stdin as FileSink).write(args.body);
    }
    await (proc.stdin as FileSink).end();

    const stdout = proc.stdout ? await new Response(proc.stdout).text() : "";
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = proc.stderr ? await new Response(proc.stderr).text() : "";
      logger.warn("opencode_http_docker_exec_failed", {
        exitCode,
        stderr: stderr.slice(0, 1000),
        url: args.url,
      });
      throw new Error("opencode_http_request_failed");
    }

    const parsed = parseCurlHttpResponse(stdout);
    return new Response(parsed.body, {
      headers: parsed.headers,
      status: parsed.status,
    });
  } finally {
    if (args.signal) {
      args.signal.removeEventListener("abort", abortHandler);
    }
  }
}

async function dockerExecCurlStream(args: {
  containerName: string;
  url: string;
  method: string;
  headers: Headers;
  signal: AbortSignal | null;
}): Promise<Response> {
  assertAgentfsContainerName(args.containerName);

  const curlArgs: string[] = [
    "curl",
    "-sS",
    "-N",
    "--request",
    args.method,
    "-H",
    "accept-encoding: identity",
  ];

  for (const [k, v] of args.headers.entries()) {
    if (k.toLowerCase() === "host") {
      continue;
    }
    curlArgs.push("-H", `${k}: ${v}`);
  }

  curlArgs.push(args.url);

  const proc = spawnProc(
    ["docker", "exec", "-i", args.containerName, ...curlArgs],
    {
      env: process.env,
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    }
  );

  void drain(proc.stderr).catch(() => {});

  const abortHandler = () => {
    try {
      proc.kill();
    } catch {
      // ignore
    }
  };

  if (args.signal) {
    if (args.signal.aborted) {
      abortHandler();
      throw new DOMException("Aborted", "AbortError");
    }
    args.signal.addEventListener("abort", abortHandler, { once: true });
  }

  void proc.exited
    .then((exitCode) => {
      if (exitCode !== 0) {
        logger.warn("opencode_http_docker_exec_failed", {
          exitCode,
          url: args.url,
        });
      }
    })
    .finally(() => {
      if (args.signal) {
        args.signal.removeEventListener("abort", abortHandler);
      }
    })
    .catch(() => {});

  const outHeaders = new Headers();
  if (!outHeaders.has("content-type")) {
    outHeaders.set("content-type", "text/event-stream");
  }

  if (proc.stdout && typeof proc.stdout !== "number") {
    return new Response(proc.stdout as ReadableStream<Uint8Array>, {
      headers: outHeaders,
      status: 200,
    });
  }

  abortHandler();
  throw new Error("opencode_http_sse_unavailable");
}

export function createOpencodeFetch(args: {
  containerName?: string;
  username?: string;
  password?: string;
}): (req: Request) => Promise<Response> {
  const authHeader =
    args.username && args.password
      ? basicAuth(args.username, args.password)
      : undefined;

  const { containerName } = args;
  if (containerName) {
    return async (req: Request) => {
      const headers = new Headers(req.headers);
      if (authHeader && !headers.has("authorization")) {
        headers.set("authorization", authHeader);
      }

      const signal = req.signal ?? null;
      if (isSseRequest(req)) {
        return dockerExecCurlStream({
          containerName,
          headers,
          method: req.method,
          signal,
          url: req.url,
        });
      }

      const body = await readRequestBody(req);
      return dockerExecCurl({
        body,
        containerName,
        headers,
        method: req.method,
        signal,
        url: req.url,
      });
    };
  }

  return (req: Request) => {
    const headers = new Headers(req.headers);
    if (authHeader && !headers.has("authorization")) {
      headers.set("authorization", authHeader);
    }
    const next = new Request(req, { headers });
    return fetch(next);
  };
}

export const __internals = {
  resetSpawn: () => {
    spawnProc = spawn;
  },
  setSpawn: (fn: SpawnProc) => {
    spawnProc = fn;
  },
};
