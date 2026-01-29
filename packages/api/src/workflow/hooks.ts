import type { PipelineObserver } from "@alfred/pipeline";
import type { HookContext, HookRegistry } from "@alfred/type";
import type { RuntimeContext } from "@alfred/type/runtime-context";

import { logger } from "@alfred/logger";
import * as path from "node:path";

const baseCognitive: HookContext["cognitive"] = {
  state: "idle",
  autonomy: 0.5,
  physiology: {
    energy: 1,
    boredom: 0,
    frustration: 0,
  },
};

export interface AttachHooksObserverOptions {
  readonly sessionId: string;
  readonly runId: string;
  readonly workspace: string;
  readonly signal: AbortSignal;
}

export interface HooksRuntime {
  readonly registry: HookRegistry;
  readonly ctx: HookContext;
}

export interface EnsureHooksRuntimeOptions {
  readonly sessionId?: string;
  readonly workflowId?: string;
  readonly workspace: string;
  readonly signal: AbortSignal;
}

function isHooksRuntime(value: unknown): value is HooksRuntime {
  if (!value || typeof value !== "object") {
    return false;
  }
  const rec = value as Record<string, unknown>;
  const registry = rec.registry as Record<string, unknown> | undefined;
  const ctx = rec.ctx as Record<string, unknown> | undefined;
  if (
    !registry ||
    typeof registry.emit !== "function" ||
    typeof registry.on !== "function"
  ) {
    return false;
  }
  if (!ctx || typeof ctx.sessionId !== "string") {
    return false;
  }
  return true;
}

function canUseRuntimeContext(
  value: RuntimeContext | null | undefined
): value is RuntimeContext {
  if (!value) {
    return false;
  }
  const rec = value as unknown as Record<string, unknown>;
  return typeof rec.get === "function" && typeof rec.set === "function";
}

async function createHooksRuntime(
  options: EnsureHooksRuntimeOptions
): Promise<HooksRuntime> {
  const { createHookRegistry, loadHooksJsonFile } =
    await import("@alfred/hooks");

  const registry = createHookRegistry();
  const hooksFile = path.join(options.workspace, "hooks.json");

  try {
    if (await Bun.file(hooksFile).exists()) {
      registry.loadConfig(await loadHooksJsonFile(hooksFile));
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn("hooks_config_load_failed", { error: msg, hooksFile });
  }

  const sessionId =
    options.sessionId ??
    process.env.ALFRED_SESSION_ID ??
    process.env.ALFRED_REQUEST_ID ??
    "unknown";

  const hookCtx: HookContext = {
    sessionId,
    workflowId: options.workflowId,
    autonomy: 0.5,
    cognitive: baseCognitive,
    alfredVersion: process.env.ALFRED_VERSION ?? "dev",
    projectDir: options.workspace,
    emit: async () => {},
    signal: options.signal,
    log: {
      debug: (msg, data) => logger.debug(msg, data as any),
      info: (msg, data) => logger.info(msg, data as any),
      warn: (msg, data) => logger.warn(msg, data as any),
      error: (msg, data) => logger.error(msg, data as any),
    },
  };

  return { ctx: hookCtx, registry };
}

export async function ensureHooksRuntime(
  runtimeContext: RuntimeContext | null | undefined,
  options: EnsureHooksRuntimeOptions
): Promise<HooksRuntime> {
  const ctx = canUseRuntimeContext(runtimeContext) ? runtimeContext : null;
  const existing = ctx?.get("hooks" as any) as unknown;
  if (isHooksRuntime(existing)) {
    return existing;
  }

  const created = await createHooksRuntime(options);
  ctx?.set("hooks", created);
  return created;
}

export async function attachHooksObserver(
  runner: { addObserver: (observer: PipelineObserver) => unknown },
  options: AttachHooksObserverOptions
): Promise<void> {
  const { HooksObserver } = await import("@alfred/hookpipe");
  const hooks = await createHooksRuntime({
    sessionId: options.sessionId,
    signal: options.signal,
    workspace: options.workspace,
    workflowId: options.runId,
  });

  runner.addObserver(new HooksObserver(hooks));
}
