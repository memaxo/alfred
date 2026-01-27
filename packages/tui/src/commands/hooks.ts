import type { HookContext, HookEvent } from "@alfred/type";

import { createHookRegistry, loadHooksJsonFile } from "@alfred/hooks";
import { mkdir } from "node:fs/promises";
import path from "node:path";

function writeStdout(text: string): void {
  process.stdout.write(text);
}

function writeStderr(text: string): void {
  process.stderr.write(text);
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function getFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1) {
    return null;
  }
  const next = args[idx + 1];
  if (!next || next.startsWith("--")) {
    return null;
  }
  return next;
}

function getWorkspace(args: string[]): string {
  return getFlag(args, "--dir") ?? process.cwd();
}

function parseJsonArg(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function createTestHookContext(options: {
  sessionId: string;
  workflowId?: string;
  projectDir: string;
  trace: boolean;
}): { ctx: HookContext; events: HookEvent[] } {
  const events: HookEvent[] = [];
  const ctrl = new AbortController();

  const ctx: HookContext = {
    sessionId: options.sessionId,
    workflowId: options.workflowId,
    autonomy: 0.5,
    cognitive: {
      state: "idle",
      autonomy: 0.5,
      physiology: {
        energy: 1,
        boredom: 0,
        frustration: 0,
      },
    },
    alfredVersion: process.env.ALFRED_VERSION ?? "dev",
    projectDir: options.projectDir,
    signal: ctrl.signal,
    emit: async (e) => {
      events.push(e as HookEvent);
      if (options.trace) {
        writeStdout(`${JSON.stringify(e)}\n`);
      }
    },
    log: {
      debug: (msg, data) =>
        options.trace
          ? writeStdout(`${msg} ${JSON.stringify(data ?? {})}\n`)
          : undefined,
      info: (msg, data) =>
        options.trace
          ? writeStdout(`${msg} ${JSON.stringify(data ?? {})}\n`)
          : undefined,
      warn: (msg, data) =>
        options.trace
          ? writeStderr(`${msg} ${JSON.stringify(data ?? {})}\n`)
          : undefined,
      error: (msg, data) =>
        writeStderr(`${msg} ${JSON.stringify(data ?? {})}\n`),
    },
  };

  return { ctx, events };
}

async function createHooksJsonScaffold(opts: {
  workspace: string;
  force: boolean;
}): Promise<void> {
  const hooksJsonPath = path.join(opts.workspace, "hooks.json");
  const hooksDir = path.join(opts.workspace, "hooks");
  const hookScriptPath = path.join(hooksDir, "echo.ts");

  if (!opts.force && (await Bun.file(hooksJsonPath).exists())) {
    throw new Error("hooks_json_already_exists");
  }

  await mkdir(hooksDir, { recursive: true });

  if (opts.force || !(await Bun.file(hookScriptPath).exists())) {
    await Bun.write(
      hookScriptPath,
      `${`
#!/usr/bin/env bun

const raw = await Bun.stdin.text();
const line = raw.trim().split("\n").filter(Boolean).pop() ?? "{}";
const input = JSON.parse(line);
const hookEvent = input?.hookEvent;
const payload = input?.payload ?? {};

if (hookEvent === "voice:stt:after" && typeof payload.transcript === "string") {
  const transcript = payload.transcript.replace(/\bteh\b/g, "the");
  process.stdout.write(
    JSON.stringify({ transformed: { ...payload, transcript } }) + "\n"
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({ decision: "allow" }) + "\n");
process.exit(0);
`.trim()}
`
    );
  }

  const scaffold = {
    version: 1,
    hooks: {
      "voice:stt:after": [
        {
          command: "bun hooks/echo.ts",
          timeout: 2,
          transform: true,
        },
      ],
    },
  };

  await Bun.write(hooksJsonPath, `${JSON.stringify(scaffold, null, 2)}\n`);
  writeStdout(`created ${hooksJsonPath}\n`);
  writeStdout(`created ${hookScriptPath}\n`);
}

async function validateHooksJson(hooksJsonPath: string): Promise<void> {
  const cfg = await loadHooksJsonFile(hooksJsonPath);
  const types = Object.keys(cfg.hooks ?? {}) as HookEvent["type"][];
  const total = types.reduce(
    (sum, t) => sum + (cfg.hooks?.[t]?.length ?? 0),
    0
  );
  writeStdout(`ok ${types.length} event_types ${total} hooks\n`);
}

async function runHookTest(args: string[], trace: boolean): Promise<void> {
  const workspace = getWorkspace(args);
  const hooksJsonPath =
    getFlag(args, "--file") ?? path.join(workspace, "hooks.json");
  const eventType = getFlag(args, "--event");
  if (!eventType) {
    throw new Error("hooks_test_event_required");
  }

  const payloadRaw = getFlag(args, "--payload") ?? "{}";
  const payload = parseJsonArg(payloadRaw);
  if (!payload || typeof payload !== "object") {
    throw new Error("hooks_test_payload_invalid");
  }

  const registry = createHookRegistry();
  registry.loadConfig(await loadHooksJsonFile(hooksJsonPath));

  const { ctx, events } = createTestHookContext({
    sessionId: getFlag(args, "--session") ?? "cli",
    workflowId: getFlag(args, "--workflow") ?? undefined,
    projectDir: workspace,
    trace,
  });

  const event = { type: eventType, ...(payload as Record<string, unknown>) };
  const out = await registry.emit(event as HookEvent, ctx);
  writeStdout(`${JSON.stringify(out)}\n`);
  if (trace) {
    void events;
  }
}

export async function hooksCommands(args: string[]): Promise<void> {
  const sub = args[0];

  if (hasFlag(args, "--help") || hasFlag(args, "-h") || !sub) {
    writeStdout(
      `${`
Usage: alfred hooks <command> [options]

Commands:
  create    Scaffold hooks.json + a sample hook script
  validate  Validate hooks.json schema
  test      Execute a hook event against hooks.json
  debug     Like test, but prints hook:executed/hook:error traces

Options:
  --dir <path>       Workspace directory (default cwd)
  --file <path>      hooks.json path (default <dir>/hooks.json)

Test/Debug options:
  --event <type>     Hook event type to emit (required)
  --payload <json>   Event payload JSON (default {})
  --session <id>     HookContext.sessionId (default "cli")
  --workflow <id>    HookContext.workflowId
`.trim()}
`
    );
    return;
  }

  if (sub === "create") {
    await createHooksJsonScaffold({
      workspace: getWorkspace(args.slice(1)),
      force: hasFlag(args, "--force"),
    });
    return;
  }

  const workspace = getWorkspace(args);
  const hooksJsonPath =
    getFlag(args, "--file") ?? path.join(workspace, "hooks.json");

  if (sub === "validate") {
    await validateHooksJson(hooksJsonPath);
    return;
  }

  if (sub === "test") {
    await runHookTest(args.slice(1), false);
    return;
  }

  if (sub === "debug") {
    await runHookTest(args.slice(1), true);
    return;
  }

  throw new Error("hooks_command_invalid");
}
