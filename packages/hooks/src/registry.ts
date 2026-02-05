import {
  DEFAULT_FAIL_MODES,
  DEFAULT_HOOK_BUDGETS,
  type HookBudget,
  type HookConfig,
  type HookContext,
  type HookEvent,
  type HookEventType,
  type HookFailMode,
  type HookHandler,
  type HookHandlerResult,
  type HookOutput,
  type HookRegistry,
  type HooksJsonConfig,
} from "@alfred/type";

import type {
  HookBudgetExceededEvent,
  HookErrorEvent,
  HookExecutedEvent,
} from "./events";

import { resolveBudgetMs, resolveFailMode } from "./budgets";
import { executeHookConfig } from "./executor";
import { matchesHook } from "./matchers";

interface RegistryOptions {
  readonly budgets?: readonly HookBudget[];
  readonly failModes?: Partial<Record<string, HookFailMode>>;
  readonly now?: () => number;
}

interface HandlerEntry {
  readonly handler: HookHandler<HookEvent>;
  readonly config?: HookConfig;
}

export function createHookRegistry(
  options: RegistryOptions = {}
): HookRegistry {
  const handlers = new Map<string, HandlerEntry[]>();
  const now = options.now ?? (() => performance.now());
  const budgets = options.budgets ?? DEFAULT_HOOK_BUDGETS;
  const failModes = options.failModes ?? DEFAULT_FAIL_MODES;

  function add(eventType: string, entry: HandlerEntry): () => void {
    const list = handlers.get(eventType) ?? [];
    list.push(entry);
    handlers.set(eventType, list);

    return () => {
      const next = (handlers.get(eventType) ?? []).filter((e) => e !== entry);
      if (next.length === 0) {
        handlers.delete(eventType);
      } else {
        handlers.set(eventType, next);
      }
    };
  }

  async function emit<T extends HookEvent>(
    event: T,
    ctx: HookContext
  ): Promise<HookOutput<T>> {
    const eventType = event.type;
    const list = handlers.get(eventType) ?? [];
    const budgetMs = resolveBudgetMs(eventType, budgets);

    let current: HookEvent = event;
    let out: HookOutput<HookEvent> = {};

    for (const entry of list) {
      if (
        entry.config?.matcher &&
        !matchesHook(current, entry.config.matcher)
      ) {
        continue;
      }

      const start = now();
      let res: HookHandlerResult<HookEvent> | undefined;
      let ok = true;
      let decision: HookOutput<HookEvent>["decision"] | undefined;

      try {
        res = await entry.handler(current, ctx);

        if (res && typeof res === "object" && "decision" in res) {
          ({ decision } = res as HookOutput<HookEvent>);
        }
      } catch (error) {
        ok = false;
        const failOverride =
          entry.config && "failMode" in entry.config
            ? entry.config.failMode
            : undefined;
        const failMode = resolveFailMode(eventType, failOverride, failModes);
        const msg = error instanceof Error ? error.message : String(error);
        ctx.log.error("hook_error", {
          hookEvent: eventType,
          failMode,
          error: msg,
        });

        await ctx.emit({
          type: "hook:error",
          hookEvent: eventType,
          error: msg,
          failMode,
        } satisfies HookErrorEvent);

        if (failMode === "closed") {
          return { decision: "deny", reason: `hook_failed:${msg}` };
        }
        continue;
      } finally {
        const dur = now() - start;
        if (dur > budgetMs) {
          await ctx.emit({
            type: "hook:budget:exceeded",
            hookEvent: eventType,
            durationMs: dur,
            budgetMs,
          } satisfies HookBudgetExceededEvent);
        }

        await ctx.emit({
          type: "hook:executed",
          hookEvent: eventType,
          durationMs: dur,
          budgetMs,
          ok,
          decision,
          hook: entry.config
            ? {
                kind:
                  "command" in entry.config
                    ? "command"
                    : (entry.config.type === "prompt"
                      ? "prompt"
                      : "handler"),
                ref:
                  "command" in entry.config
                    ? entry.config.command
                    : (entry.config.type === "prompt"
                      ? entry.config.model
                      : undefined),
              }
            : { kind: "handler" },
        } satisfies HookExecutedEvent);
      }

      if (res && typeof res === "object" && "type" in res) {
        const maybeEvent = res as unknown as HookEvent;
        if (maybeEvent.type === eventType) {
          current = maybeEvent;
          out = mergeOutput(out, { transformed: current });
          continue;
        }
      }

      const hookOut = (res ?? {}) as HookOutput<HookEvent>;
      out = mergeOutput(out, hookOut);

      if (hookOut.transformed) {
        current = hookOut.transformed;
      }

      if (hookOut.emit && hookOut.emit.length > 0) {
        for (const e of hookOut.emit) {
          await ctx.emit(e);
        }
      }

      if (hookOut.decision === "deny" || hookOut.decision === "ask") {
        return mergeOutput(out, { transformed: current }) as HookOutput<T>;
      }

      if (hookOut.skipRemaining === true) {
        break;
      }
    }

    if (current !== event) {
      out = mergeOutput(out, { transformed: current });
    }

    return out as HookOutput<T>;
  }

  function loadConfig(config: HooksJsonConfig): void {
    if (config.version !== 1) {
      throw new Error("hooks_config_version_unsupported");
    }

    for (const [eventType, hookConfigs] of Object.entries(config.hooks ?? {})) {
      if (!hookConfigs || hookConfigs.length === 0) {
        continue;
      }

      for (const hookConfig of hookConfigs) {
        add(eventType, {
          config: hookConfig,
          handler: async (event: HookEvent, ctx: HookContext) =>
            executeHookConfig(eventType, hookConfig, event, ctx),
        });
      }
    }
  }

  return {
    on<T extends HookEventType>(
      event: T,
      handler: HookHandler<Extract<HookEvent, { type: T }>>
    ) {
      const wrapped: HookHandler<HookEvent> = (e, ctx) =>
        handler(e as Extract<HookEvent, { type: T }>, ctx);
      return add(event, { handler: wrapped });
    },
    emit,
    loadConfig,
    registeredEvents() {
      return [...handlers.keys()] as HookEventType[];
    },
  } satisfies HookRegistry;
}

function mergeOutput<T extends HookEvent>(
  prev: HookOutput<T>,
  next: HookOutput<T>
): HookOutput<T> {
  return {
    decision: next.decision ?? prev.decision,
    reason: next.reason ?? prev.reason,
    userMessage: next.userMessage ?? prev.userMessage,
    agentMessage: next.agentMessage ?? prev.agentMessage,
    transformed: next.transformed ?? prev.transformed,
    followupMessage: next.followupMessage ?? prev.followupMessage,
    env:
      prev.env || next.env
        ? { ...(prev.env ?? {}), ...(next.env ?? {}) }
        : undefined,
    additionalContext:
      prev.additionalContext || next.additionalContext
        ? [prev.additionalContext, next.additionalContext]
            .filter(Boolean)
            .join("\n")
        : undefined,
    emit:
      prev.emit || next.emit
        ? [...(prev.emit ?? []), ...(next.emit ?? [])]
        : undefined,
    learn: next.learn ?? prev.learn,
    skipRemaining: next.skipRemaining ?? prev.skipRemaining,
  };
}
