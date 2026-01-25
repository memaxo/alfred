import type { HookDecision, HookFailMode } from "@alfred/type";

export interface HookExecutedEvent {
  readonly type: "hook:executed";
  readonly hookEvent: string;
  readonly durationMs: number;
  readonly budgetMs: number;
  readonly ok: boolean;
  readonly decision?: HookDecision;
  readonly hook?: {
    readonly kind: "handler" | "command" | "prompt";
    readonly ref?: string;
  };
}

export interface HookBudgetExceededEvent {
  readonly type: "hook:budget:exceeded";
  readonly hookEvent: string;
  readonly durationMs: number;
  readonly budgetMs: number;
}

export interface HookErrorEvent {
  readonly type: "hook:error";
  readonly hookEvent: string;
  readonly error: string;
  readonly failMode: HookFailMode;
}

export type HookSystemEvent =
  | HookExecutedEvent
  | HookBudgetExceededEvent
  | HookErrorEvent;
