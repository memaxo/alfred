import { createContext, useContext } from "react";

import type { AgentFSSubscription } from "../../subscriptions/agentfs";
import type { CognitiveStateStore } from "../../subscriptions/cognitive";
import type { FocusStore } from "../../subscriptions/focus";
import type { MetricsStore } from "../../subscriptions/metrics";
import type { SelectionStore } from "../../subscriptions/selection";
import type { VoiceStore } from "../../subscriptions/voice";
import type { WorkflowStore } from "../../subscriptions/workflow";

export interface TuiStores {
  cognitive: CognitiveStateStore;
  workflow: WorkflowStore;
  voice: VoiceStore;
  metrics: MetricsStore;
  focus: FocusStore;
  agentfs: AgentFSSubscription;
  selection: SelectionStore;
}

export const StoresContext = createContext<TuiStores | null>(null);

export function useStores(): TuiStores | null {
  return useContext(StoresContext);
}

export function useCognitiveStore(): CognitiveStateStore | null {
  return useStores()?.cognitive ?? null;
}

export function useWorkflowStore(): WorkflowStore | null {
  return useStores()?.workflow ?? null;
}

export function useVoiceStore(): VoiceStore | null {
  return useStores()?.voice ?? null;
}

export function useMetricsStore(): MetricsStore | null {
  return useStores()?.metrics ?? null;
}

export function useFocusStore(): FocusStore | null {
  return useStores()?.focus ?? null;
}

export function useAgentFSStore(): AgentFSSubscription | null {
  return useStores()?.agentfs ?? null;
}

export function useSelectionStore(): SelectionStore | null {
  return useStores()?.selection ?? null;
}
