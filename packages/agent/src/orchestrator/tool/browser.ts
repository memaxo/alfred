import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { accessSync, constants as fsConstants } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import type { DirectoryHandle } from "../../security/filesystem.js";
import type { ToolWriter } from "./shared/context.js";

import {
  DEFAULT_ALLOW_PREFIXES,
  DirectoryAccessError,
  openDirectorySecure,
} from "../../security/filesystem.js";
import { withPolicyApproval, type AITool } from "./approval.js";
import { resolveExecutable } from "./shared/subprocess.js";

const MIN_TIMEOUT_SEC = 5;
const MAX_TIMEOUT_SEC = 10 * 60;
const DEFAULT_TIMEOUT_SEC = 60;

type BrowserAction =
  | "open"
  | "snapshot"
  | "click"
  | "fill"
  | "type"
  | "press"
  | "wait"
  | "get.text"
  | "get.url"
  | "get.title"
  | "is.visible"
  | "is.enabled"
  | "screenshot"
  | "state.save"
  | "state.load"
  | "close";

const READ_ONLY_ACTIONS = new Set<BrowserAction>([
  "snapshot",
  "get.text",
  "get.url",
  "get.title",
  "is.visible",
  "is.enabled",
]);

const snapshotOptionsSchema = z
  .object({
    compact: z.boolean().optional(),
    depth: z.number().int().min(1).max(10).optional(),
    interactive: z.boolean().optional(),
    scope: z.string().min(1).optional(),
  })
  .strict();

export const browserInputSchema = z
  .object({
    action: z.enum([
      "open",
      "snapshot",
      "click",
      "fill",
      "type",
      "press",
      "wait",
      "get.text",
      "get.url",
      "get.title",
      "is.visible",
      "is.enabled",
      "screenshot",
      "state.save",
      "state.load",
      "close",
    ]),

    /**
     * Run identifier used for session + artifact names.
     * If absent, the tool falls back to `session` or "default".
     */
    runId: z.string().min(1).optional(),

    /** agent-browser session name (overrides runId-derived name) */
    session: z.string().min(1).optional(),

    /** Working directory for subprocess sandboxing (defaults to process.cwd). */
    cw: z.string().optional(),

    /** Navigation target for `open`. */
    url: z.string().min(1).optional(),

    /** Selector or ref (e.g. "@e2") for element actions. */
    selector: z.string().min(1).optional(),

    /** Text payload for fill/type. */
    text: z.string().optional(),

    /** Key for press (e.g., "Enter", "Tab"). */
    key: z.string().min(1).optional(),

    /** Screenshot file path (relative to repo root or absolute). */
    file: z.string().min(1).optional(),

    /** State path for state.save/state.load (relative to repo root or absolute). */
    state: z.string().min(1).optional(),

    /** Snapshot options (defaults: interactive+compact, depth 6). */
    snapshot: snapshotOptionsSchema.optional(),

    /**
     * Extra HTTP headers (only applied on `open` and scoped to that origin).
     * Stored as JSON in the CLI flag.
     */
    headers: z.record(z.string(), z.string()).optional(),

    /**
     * Optional base directory for failure artifacts.
     * When omitted, defaults to `.agent/artifacts/browser/<runIdOrSession>`.
     */
    artifacts: z
      .object({
        dir: z.string().min(1).optional(),
      })
      .strict()
      .optional(),

    authz: z.string().optional(),
    timeoutSec: z
      .number()
      .int()
      .min(MIN_TIMEOUT_SEC)
      .max(MAX_TIMEOUT_SEC)
      .optional(),
  })
  .strict();

export type BrowserInput = z.infer<typeof browserInputSchema>;

const browserOutputSchema = z.object({
  action: z.string(),
  details: z
    .object({
      data: z.unknown().optional(),
      error: z.string().optional(),
      stdout: z.string().optional(),
      stderr: z.string().optional(),
      exitCode: z.number().int().optional(),
      artifacts: z
        .object({
          screenshot: z.string().optional(),
          snapshot: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  ok: z.boolean(),
  session: z.string(),
});

export type BrowserToolOutput = z.infer<typeof browserOutputSchema>;

function ensure<T>(value: T | undefined, error: string): T {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      throw new Error(error);
    }
    return value as T;
  }
  if (typeof value === "undefined") {
    throw new TypeError(error);
  }
  return value;
}

function sanitizeSessionName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return "default";
  }
  return trimmed.replaceAll(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 64) || "default";
}

function resolveSessionName(input: BrowserInput): string {
  if (input.session) {
    return sanitizeSessionName(input.session);
  }
  if (input.runId) {
    return sanitizeSessionName(`run-${input.runId}`);
  }
  return "default";
}

function acquireWorkingDirectoryHandle(candidate?: string): DirectoryHandle {
  try {
    return openDirectorySecure(candidate ?? process.cwd(), {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
    });
  } catch (error) {
    if (
      error instanceof DirectoryAccessError &&
      error.code === "not_directory"
    ) {
      throw new Error("browser_invalid_cwd_not_directory", { cause: error });
    }
    throw new Error("browser_invalid_cwd", { cause: error });
  }
}

async function enforcePolicy(input: BrowserInput, session: string) {
  const scopes = READ_ONLY_ACTIONS.has(input.action as BrowserAction)
    ? ["web.read"]
    : ["web.write"];

  await requireToolScopesAndPolicy(input.authz, scopes, {
    action: `browser.${input.action}`,
    resource: {
      id: input.url ?? input.selector ?? session,
      kind: "web",
    },
  });
}

function resolveArtifactDir(params: {
  cwd: string;
  input: BrowserInput;
  session: string;
}) {
  const { cwd, input, session } = params;
  const key = input.runId ?? session;
  const fallback = path.join(cwd, ".agent", "artifacts", "browser", key);
  const configured = input.artifacts?.dir?.trim();
  if (!configured) {
    return fallback;
  }
  const absolute = path.isAbsolute(configured)
    ? configured
    : path.join(cwd, configured);
  // Keep artifacts within repo-root to avoid surprising writes.
  const normalized = path.normalize(absolute);
  if (!normalized.startsWith(cwd)) {
    return fallback;
  }
  return normalized;
}

type AgentBrowserJson =
  | { success: true; data?: unknown }
  | { success: false; error?: unknown; data?: unknown };

function parseAgentBrowserJson(stdout: string): AgentBrowserJson | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.success !== "boolean") {
      return null;
    }
    if (record.success) {
      return { data: record.data, success: true };
    }
    return { data: record.data, error: record.error, success: false };
  } catch {
    return null;
  }
}

async function readAllText(
  readable: ReadableStream<Uint8Array> | number | null | undefined
): Promise<string> {
  if (!readable || typeof readable === "number") {
    return "";
  }
  try {
    const maybeText = (readable as unknown as { text?: () => Promise<string> })
      .text;
    if (typeof maybeText === "function") {
      return await maybeText.call(readable);
    }
    return await new Response(readable).text();
  } catch {
    // Fall back to manual reader if Response wrapper fails.
    const reader = readable.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
      const flush = decoder.decode();
      if (flush.length > 0) {
        chunks.push(flush);
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
    return chunks.join("");
  }
}

function buildBrowserEnv(session: string): Record<string, string> {
  const env: Record<string, string> = {
    AGENT_BROWSER_SESSION: session,
    HOME: process.env.HOME ?? os.homedir(),
    PATH: process.env.PATH ?? "",
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }
    if (
      key.startsWith("AGENT_BROWSER_") ||
      key.startsWith("PLAYWRIGHT_") ||
      key.startsWith("PW_") ||
      key === "TMPDIR" ||
      key === "TEMP" ||
      key === "TMP" ||
      key === "LANG" ||
      key === "LC_ALL" ||
      key === "CI"
    ) {
      env[key] = value;
    }
  }

  return env;
}

async function runAgentBrowser(params: {
  cwdHandle: DirectoryHandle;
  session: string;
  args: string[];
  timeoutSec: number;
  writer?: ToolWriter;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { cwdHandle, session, args, timeoutSec, writer } = params;
  const command = (() => {
    const override = process.env.AGENT_BROWSER_BIN?.trim();
    if (override) {
      const absolute = path.isAbsolute(override)
        ? override
        : path.resolve(process.cwd(), override);
      accessSync(absolute, fsConstants.X_OK);
      return absolute;
    }

    const local = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      "agent-browser"
    );
    try {
      accessSync(local, fsConstants.X_OK);
      return local;
    } catch {
      // ignore
    }

    return resolveExecutable("agent-browser", "browser");
  })();
  const fullArgs = ["--session", session, "--json", ...args];

  const proc = Bun.spawn([command, ...fullArgs], {
    cwd: cwdHandle.path,
    env: buildBrowserEnv(session),
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });

  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    try {
      proc.kill("SIGKILL");
    } catch {
      // noop
    }
    void Promise.resolve(
      writer?.write?.({ message: "browser_timeout", type: "notice" })
    ).catch(() => {});
  }, timeoutSec * 1000);

  try {
    const stdoutPromise = readAllText(proc.stdout);
    const stderrPromise = readAllText(proc.stderr);
    const exitCode = await proc.exited;
    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

    if (stdout.length > 0) {
      void Promise.resolve(
        writer?.write?.({ text: stdout, type: "stdout" })
      ).catch(() => {});
    }
    if (stderr.length > 0) {
      void Promise.resolve(
        writer?.write?.({ text: stderr, type: "stderr" })
      ).catch(() => {});
    }

    if (didTimeout) {
      throw new Error("browser_exec_timeout");
    }

    return { exitCode, stderr, stdout };
  } finally {
    clearTimeout(timer);
  }
}

function buildCommandArgs(input: BrowserInput): string[] {
  switch (input.action as BrowserAction) {
    case "open": {
      const url = ensure(input.url, "browser_url_required");
      const args = ["open", url];
      if (input.headers && Object.keys(input.headers).length > 0) {
        args.push("--headers", JSON.stringify(input.headers));
      }
      return args;
    }
    case "snapshot": {
      const opts = input.snapshot ?? {};
      const interactive = opts.interactive ?? true;
      const compact = opts.compact ?? true;
      const depth = opts.depth ?? 6;
      const args = ["snapshot"];
      if (interactive) {
        args.push("-i");
      }
      if (compact) {
        args.push("-c");
      }
      args.push("-d", String(depth));
      if (opts.scope) {
        args.push("-s", opts.scope);
      }
      return args;
    }
    case "click": {
      const selector = ensure(input.selector, "browser_selector_required");
      return ["click", selector];
    }
    case "fill": {
      const selector = ensure(input.selector, "browser_selector_required");
      const text = ensure(input.text, "browser_text_required");
      return ["fill", selector, text];
    }
    case "type": {
      const selector = ensure(input.selector, "browser_selector_required");
      const text = ensure(input.text, "browser_text_required");
      return ["type", selector, text];
    }
    case "press": {
      const key = ensure(input.key, "browser_key_required");
      return ["press", key];
    }
    case "wait": {
      // Supports either numeric ms in `text` or selector in `selector`
      if (input.selector) {
        return ["wait", input.selector];
      }
      if (input.text && input.text.trim().length > 0) {
        return ["wait", input.text.trim()];
      }
      throw new Error("browser_wait_target_required");
    }
    case "get.text": {
      const selector = ensure(input.selector, "browser_selector_required");
      return ["get", "text", selector];
    }
    case "get.url": {
      return ["get", "url"];
    }
    case "get.title": {
      return ["get", "title"];
    }
    case "is.visible": {
      const selector = ensure(input.selector, "browser_selector_required");
      return ["is", "visible", selector];
    }
    case "is.enabled": {
      const selector = ensure(input.selector, "browser_selector_required");
      return ["is", "enabled", selector];
    }
    case "screenshot": {
      const file = ensure(input.file, "browser_file_required");
      return ["screenshot", file];
    }
    case "state.save": {
      const state = ensure(input.state, "browser_state_required");
      return ["state", "save", state];
    }
    case "state.load": {
      const state = ensure(input.state, "browser_state_required");
      return ["state", "load", state];
    }
    case "close": {
      return ["close"];
    }
    default: {
      throw new Error("browser_action_not_supported");
    }
  }
}

async function captureFailureArtifacts(params: {
  cwdHandle: DirectoryHandle;
  cwd: string;
  session: string;
  input: BrowserInput;
  writer?: ToolWriter;
}): Promise<{ screenshot?: string; snapshot?: string } | undefined> {
  const { cwdHandle, cwd, session, input, writer } = params;
  const dir = resolveArtifactDir({ cwd, input, session });
  const stamp = Date.now();
  const screenshot = path.join(dir, `error-${stamp}.png`);
  const snapshot = path.join(dir, `snapshot-${stamp}.json`);
  const scope = input.snapshot?.scope ?? "#main";

  try {
    await mkdir(dir, { recursive: true });
  } catch {
    return;
  }

  let screenshotPath: string | undefined;
  try {
    const result = await runAgentBrowser({
      args: ["screenshot", screenshot],
      cwdHandle,
      session,
      timeoutSec: Math.min(input.timeoutSec ?? DEFAULT_TIMEOUT_SEC, 30),
      writer,
    });
    if (result.exitCode === 0) {
      screenshotPath = screenshot;
    }
  } catch {
    // ignore screenshot failures
  }

  let snapshotPath: string | undefined;
  try {
    const snapshotResult = await runAgentBrowser({
      args: ["snapshot", "-i", "-c", "-d", "6", "-s", scope],
      cwdHandle,
      session,
      timeoutSec: Math.min(input.timeoutSec ?? DEFAULT_TIMEOUT_SEC, 30),
      writer,
    });
    if (
      snapshotResult.exitCode === 0 &&
      snapshotResult.stdout.trim().length > 0
    ) {
      await writeFile(snapshot, snapshotResult.stdout, "utf8");
      snapshotPath = snapshot;
    }
  } catch {
    // ignore snapshot failures
  }

  if (!(screenshotPath || snapshotPath)) {
    return;
  }
  return { screenshot: screenshotPath, snapshot: snapshotPath };
}

export const toolBrowser = {
  description:
    "Deterministic browser automation via agent-browser (snapshot refs + actions) for UI verification and reproducible debugging.",
  execute: async ({
    input,
    writer,
  }: {
    input: BrowserInput;
    writer?: ToolWriter;
  }): Promise<BrowserToolOutput> => {
    const session = resolveSessionName(input);
    const cwdHandle = acquireWorkingDirectoryHandle(input.cw);
    try {
      const cwd = cwdHandle.path;
      await enforcePolicy(input, session);

      const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
      const args = buildCommandArgs(input);
      let stdout = "";
      let stderr = "";
      let exitCode = 1;
      try {
        const result = await runAgentBrowser({
          cwdHandle,
          session,
          args,
          timeoutSec,
          writer,
        });
        ({ stdout } = result);
        ({ stderr } = result);
        ({ exitCode } = result);
      } catch (error) {
        const artifacts = await captureFailureArtifacts({
          cwdHandle,
          cwd,
          session,
          input,
          writer,
        });
        return {
          ok: false,
          action: input.action,
          session,
          details: {
            error: error instanceof Error ? error.message : String(error),
            stderr: stderr.trim() || undefined,
            artifacts,
          },
        };
      }

      const parsed = parseAgentBrowserJson(stdout);
      if (exitCode !== 0) {
        const artifacts = await captureFailureArtifacts({
          cwdHandle,
          cwd,
          session,
          input,
          writer,
        });
        return {
          ok: false,
          action: input.action,
          session,
          details: {
            exitCode,
            stdout: stdout.trim() || undefined,
            stderr: stderr.trim() || undefined,
            artifacts,
          },
        };
      }

      if (parsed && !parsed.success) {
        const artifacts = await captureFailureArtifacts({
          cwdHandle,
          cwd,
          session,
          input,
          writer,
        });
        return {
          ok: false,
          action: input.action,
          session,
          details: {
            data: parsed,
            stdout: stdout.trim() || undefined,
            stderr: stderr.trim() || undefined,
            exitCode,
            artifacts,
          },
        };
      }

      return {
        ok: true,
        action: input.action,
        session,
        details: {
          data:
            parsed?.data ??
            (stdout.trim().length > 0 ? stdout.trim() : undefined),
          stderr: stderr.trim() || undefined,
          exitCode,
        },
      };
    } finally {
      cwdHandle.close();
    }
  },
  inputSchema: browserInputSchema,
  name: "browser",
  outputSchema: browserOutputSchema,
};

const aiToolBrowserBase = {
  description: toolBrowser.description,
  execute: async (input: BrowserInput) => toolBrowser.execute({ input }),
  inputSchema: toolBrowser.inputSchema,
  name: toolBrowser.name,
  parameters: toolBrowser.inputSchema,
};

export const aiToolBrowser: AITool<BrowserInput, any> = withPolicyApproval(
  aiToolBrowserBase,
  (input) => {
    const session = resolveSessionName(input);
    const scopes = READ_ONLY_ACTIONS.has(input.action as BrowserAction)
      ? ["web.read"]
      : ["web.write"];
    return {
      action: `browser.${input.action}`,
      authz: input.authz,
      resource: {
        kind: "web",
        id: input.url ?? input.selector ?? session,
      },
      scopes,
    };
  }
);

export const __internals = {
  READ_ONLY_ACTIONS,
  buildCommandArgs,
  parseAgentBrowserJson,
  resolveArtifactDir,
  resolveSessionName,
  sanitizeSessionName,
};
