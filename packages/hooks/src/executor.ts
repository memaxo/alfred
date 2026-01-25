import type {
  CommandHookConfig,
  HookConfig,
  HookContext,
  HookEvent,
  HookOutput,
  PromptHookConfig,
} from "@alfred/type";

import { z } from "zod";

const hookOutputSchema = z
  .object({
    decision: z.enum(["allow", "deny", "ask"]).optional(),
    reason: z.string().optional(),
    userMessage: z.string().optional(),
    agentMessage: z.string().optional(),
    transformed: z.unknown().optional(),
    followupMessage: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    additionalContext: z.string().optional(),
    emit: z.array(z.unknown()).optional(),
    learn: z
      .object({
        pattern: z.string().optional(),
        feedback: z.enum(["positive", "negative"]).optional(),
        weight: z.number().optional(),
      })
      .optional(),
    skipRemaining: z.boolean().optional(),
  })
  .passthrough();

export async function executeHookConfig(
  hookEvent: string,
  config: HookConfig,
  event: HookEvent,
  ctx: HookContext
): Promise<HookOutput<HookEvent>> {
  if ((config as PromptHookConfig).type === "prompt") {
    ctx.log.warn("prompt_hooks_not_supported", { hookEvent });
    return {};
  }

  return executeCommandHook(hookEvent, config as CommandHookConfig, event, ctx);
}

async function executeCommandHook(
  hookEvent: string,
  config: CommandHookConfig,
  event: HookEvent,
  ctx: HookContext
): Promise<HookOutput<HookEvent>> {
  const input = {
    hookEvent,
    sessionId: ctx.sessionId,
    workflowId: ctx.workflowId,
    timestamp: new Date().toISOString(),
    alfredVersion: ctx.alfredVersion,
    cognitive: ctx.cognitive,
    payload: event,
  };

  const run = async (): Promise<HookOutput<HookEvent>> => {
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "",
      LANG: process.env.LANG ?? "",
      LC_ALL: process.env.LC_ALL ?? "",
      ...buildHookEnv(hookEvent, ctx),
    };

    const argv =
      process.platform === "win32"
        ? ["cmd.exe", "/d", "/s", "/c", config.command]
        : ["/bin/sh", "-lc", config.command];

    const proc = Bun.spawn(argv, {
      cwd: ctx.projectDir ?? process.cwd(),
      env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    const killTimer =
      config.timeout && config.timeout > 0
        ? setTimeout(() => {
            proc.kill();
          }, config.timeout * 1000)
        : null;

    killTimer?.unref();

    if (!proc.stdin || typeof proc.stdin === "number") {
      proc.kill();
      throw new Error("hook_stdin_unavailable");
    }

    const sink = proc.stdin as import("bun").FileSink;
    sink.write(`${JSON.stringify(input)}\n`);
    await sink.end();

    const stdout = proc.stdout ? await new Response(proc.stdout).text() : "";
    const stderr = proc.stderr ? await new Response(proc.stderr).text() : "";
    const exitCode = await proc.exited;
    if (killTimer) {
      clearTimeout(killTimer);
    }

    const parsed = parseJson(stdout);
    const out = coerceHookOutput(parsed, hookEvent);

    if (exitCode === 0) {
      return out;
    }

    if (exitCode === 2) {
      return { ...out, decision: "deny" };
    }

    if (exitCode === 3) {
      return out;
    }

    if (exitCode === 4) {
      return { ...out, skipRemaining: true };
    }

    throw new Error(stderr || `hook_exit_${exitCode}`);
  };

  if (config.async) {
    void run().catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      ctx.log.warn("hook_async_error", { hookEvent, error: msg });
    });
    return {};
  }

  return run();
}

function buildHookEnv(
  hookEvent: string,
  ctx: HookContext
): Record<string, string> {
  return {
    ALFRED_HOOK_EVENT: hookEvent,
    ALFRED_SESSION_ID: ctx.sessionId,
    ALFRED_WORKFLOW_ID: ctx.workflowId ?? "",
    ALFRED_AUTONOMY: String(ctx.autonomy),
    ALFRED_COGNITIVE_STATE: ctx.cognitive.state,
    ALFRED_PROJECT_DIR: ctx.projectDir ?? "",
    ALFRED_VERSION: ctx.alfredVersion,
  };
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function coerceHookOutput(
  value: unknown,
  hookEvent: string
): HookOutput<HookEvent> {
  const parsed = hookOutputSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data as HookOutput<HookEvent>;
  }

  if (value && typeof value === "object" && "type" in value) {
    const t = (value as { type?: unknown }).type;
    if (t === hookEvent) {
      return { transformed: value as HookEvent };
    }
  }

  return {};
}
