import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseThreadEvent, type ThreadEvent } from "./protocol.js";

export type CodexOutputSchema = boolean | Record<string, unknown>;

export type CodexApproval = "untrusted" | "on-failure" | "on-request" | "never";

export type CodexSandbox =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export type SubprocessLike = {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill: (signal?: number | string) => void;
};

export type SpawnFn = (options: {
  cmd: string;
  args: string[];
  env: Record<string, string>;
}) => SubprocessLike;

export type RunStreamedArgs = {
  cmd: string;
  prompt: string;
  env: Record<string, string>;
  spawn: SpawnFn;
  model?: string;
  profile?: string;
  sandbox?: CodexSandbox;
  approval?: CodexApproval;
  outputSchema?: CodexOutputSchema;
  resumeThreadId?: string;
  signal?: AbortSignal;
  onStderr?: (text: string) => Promise<void> | void;
};

type TempFile = {
  path: string;
  cleanup: () => Promise<void>;
};

async function writeTempSchema(schema: CodexOutputSchema): Promise<TempFile> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "alfred-codex-"));
  const filePath = path.join(dir, "schema.json");
  await writeFile(filePath, JSON.stringify(schema), {
    encoding: "utf8",
    mode: 0o600,
  });

  return {
    path: filePath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

async function* readLines(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const idx = buffer.indexOf("\n");
        if (idx < 0) {
          break;
        }
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        yield line;
      }
    }

    buffer += decoder.decode();
    if (buffer.length > 0) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

async function drainText(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string) => Promise<void> | void
): Promise<void> {
  for await (const line of readLines(stream)) {
    const trimmed = line.trimEnd();
    if (trimmed.length === 0) {
      continue;
    }
    await onText(trimmed);
  }
}

function makeAbortError(): Error {
  const error = new Error("codex_aborted");
  error.name = "AbortError";
  return error;
}

export async function* runStreamed(
  args: RunStreamedArgs
): AsyncGenerator<ThreadEvent> {
  const {
    cmd,
    prompt,
    env,
    spawn,
    model,
    profile,
    sandbox,
    approval,
    outputSchema,
    resumeThreadId,
    signal,
    onStderr,
  } = args;

  let tmp: TempFile | null = null;
  let proc: SubprocessLike | null = null;
  let aborted = false;

  const abortListener = () => {
    aborted = true;
    try {
      proc?.kill();
    } catch {
      // ignore kill failures
    }
  };

  if (signal) {
    if (signal.aborted) {
      throw makeAbortError();
    }
    signal.addEventListener("abort", abortListener, { once: true });
  }

  try {
    const argv: string[] = ["exec"];

    if (resumeThreadId) {
      argv.push("resume", resumeThreadId);
    }

    if (sandbox) {
      argv.push("--sandbox", sandbox);
    }

    // Handle approval modes - codex CLI v0.63+ changed from --ask-for-approval to flags
    if (approval === "never") {
      // --full-auto enables automatic execution with sandbox
      argv.push("--full-auto");
    }
    // For "on-request", "on-failure", "untrusted" - default codex behavior is interactive
    // which will prompt unless --full-auto is set

    if (model) {
      argv.push("--model", model);
    }

    if (profile) {
      argv.push("--profile", profile);
    }

    if (outputSchema !== undefined) {
      tmp = await writeTempSchema(outputSchema);
      argv.push("--output-schema", tmp.path);
    }

    argv.push("--json");
    argv.push(prompt);

    proc = spawn({ cmd, args: argv, env });

    const stderrPromise =
      proc.stderr && onStderr
        ? drainText(proc.stderr, onStderr)
        : proc.stderr
          ? drainText(proc.stderr, async () => {})
          : Promise.resolve();

    if (!proc.stdout) {
      throw new Error("codex_missing_stdout");
    }

    for await (const line of readLines(proc.stdout)) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }

      if (!trimmed.startsWith("{")) {
        continue;
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(trimmed);
      } catch {
        continue;
      }

      const event = parseThreadEvent(parsedJson);
      if (event) {
        yield event;
      }
    }

    const exitCode = await proc.exited;
    await stderrPromise;

    if (aborted) {
      throw makeAbortError();
    }

    if (exitCode !== 0) {
      throw new Error(`codex_exit_${exitCode}`);
    }
  } finally {
    if (signal) {
      signal.removeEventListener("abort", abortListener);
    }

    try {
      await tmp?.cleanup();
    } catch {
      // ignore tmp cleanup failures
    }
  }
}
