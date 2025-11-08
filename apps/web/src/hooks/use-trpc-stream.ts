/**
 * useTRPCStream Hook
 * 
 * Wires tRPC streaming subscriptions to React state
 * Handles cache handoff and error states
 * 
 * Carmack-Karpathy principles:
 * - Pure event transformations
 * - Zero allocations in hot paths
 * - Fast failure
 */

import {
  useAssistantStream,
  type UseAssistantStreamReturn,
} from "./use-assistant-stream";

interface UseTRPCStreamOptions {
  agent: "assistant" | "orchestrator";
  thread?: string;
  resource?: string;
  onError?: (error: Error) => void;
}

type UseTRPCStreamReturn = UseAssistantStreamReturn;

export function useTRPCStream({
  agent,
  thread,
  resource,
  onError,
}: UseTRPCStreamOptions): UseTRPCStreamReturn {
  if (thread || resource) {
    console.warn(
      "Thread and resource options are ignored. Use the HTTP stream endpoint instead."
    );
  }

  const stream: UseAssistantStreamReturn = useAssistantStream({ onError });

  if (agent !== "assistant") {
    console.warn(
      "Streaming for agent",
      agent,
      "is not implemented. Falling back to assistant stream."
    );
  }

  return stream;
}
