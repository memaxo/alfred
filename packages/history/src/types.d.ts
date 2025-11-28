import type { ModelMessage, UIMessage } from "@alfred/type/stream";
export type HistoryTier = "anchor" | "high" | "medium" | "low";
export type HistoryBudget = {
  modelId: string;
  maxContextTokens: number;
  historyRatio?: number;
  minSystemReserveTokens?: number;
  minHeadroomTokens?: number;
  reservedToolingTokens?: number;
};
export type BuildHistoryContextOptions = {
  messages: readonly UIMessage[];
  modelId: string;
  system?: string;
  budget?: Partial<HistoryBudget>;
  source?: string;
  forceKeepIds?: Set<string> | readonly string[];
  aggressive?: boolean;
};
export type HistorySelection = {
  kept: UIMessage[];
  dropped: UIMessage[];
  tiers: Map<string, HistoryTier>;
  tierByMessage: WeakMap<UIMessage, HistoryTier>;
  keptTokens: number;
  droppedTokens: number;
  budget: {
    modelId: string;
    maxContextTokens: number;
    historyBudgetTokens: number;
    systemTokens: number;
    headroomTokens: number;
  };
};
export type BuildHistoryContextResult = {
  uiMessages: UIMessage[];
  modelMessages: ModelMessage[];
  droppedMessages: number;
  keptTokens: number;
  droppedTokens: number;
  selection: HistorySelection;
};
//# sourceMappingURL=types.d.ts.map
