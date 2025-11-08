/**
 * useAgentStream Hook
 * 
 * Composable hook for agent streaming with cache handoff
 * Handles its own error states and state management
 * 
 * Carmack-Karpathy principles:
 * - Single responsibility: streams agent messages
 * - Pure transformations: events → state
 * - Zero allocations in hot paths
 */

import {
  useAssistantStream,
  type AssistantAction,
  type UseAssistantStreamReturn,
} from "./use-assistant-stream";

interface UseAgentStreamOptions {
  agent: "assistant" | "orchestrator";
  onError?: (error: Error) => void;
}

export type UseAgentStreamReturn = UseAssistantStreamReturn;

export function useAgentStream({ agent, onError }: UseAgentStreamOptions): UseAgentStreamReturn {
  const stream = useAssistantStream({ onError });
  if (agent !== "assistant") {
    console.warn("Generic agent streaming not implemented for", agent, "— using assistant stream");
  }
  return stream;
}
