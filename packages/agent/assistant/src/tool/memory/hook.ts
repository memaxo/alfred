import type { HookContext, HookRegistry } from "@alfred/type";
import type { ToolCallOptions } from "ai";

export interface HooksRuntime {
  readonly registry: HookRegistry;
  readonly ctx: HookContext;
}

function isHooksRuntime(value: unknown): value is HooksRuntime {
  if (!value || typeof value !== "object") {
    return false;
  }
  const rec = value as Record<string, unknown>;
  const registry = rec.registry as Record<string, unknown> | undefined;
  const ctx = rec.ctx as Record<string, unknown> | undefined;
  return (
    !!registry &&
    typeof registry.emit === "function" &&
    typeof registry.on === "function" &&
    !!ctx &&
    typeof ctx.sessionId === "string"
  );
}

export function getHooksRuntime(
  options: ToolCallOptions | undefined
): HooksRuntime | null {
  const value = (options as { experimental_context?: unknown } | undefined)
    ?.experimental_context;
  if (!value || typeof value !== "object") {
    return null;
  }
  const { hooks } = value as { hooks?: unknown };
  return isHooksRuntime(hooks) ? hooks : null;
}
