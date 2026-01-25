export { createHookRegistry } from "./registry";
export type {
  HookBudgetExceededEvent,
  HookErrorEvent,
  HookExecutedEvent,
  HookSystemEvent,
} from "./events";

export {
  DEFAULT_FAIL_MODES,
  DEFAULT_HOOK_BUDGETS,
  type CommandHookConfig,
  type HookBudget,
  type HookCategory,
  type HookConfig,
  type HookContext,
  type HookDecision,
  type HookEvent,
  type HookEventType,
  type HookFailMode,
  type HookFeedback,
  type HookHandler,
  type HookHandlerResult,
  type HookInput,
  type HookMatcher,
  type HookOutput,
  type HookRegistry,
  type HooksJsonConfig,
  type PromptHookConfig,
} from "@alfred/type";

export { loadHooksJsonFile } from "./loader";
