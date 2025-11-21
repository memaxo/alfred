import { logger } from "@alfred/logger";
import {
  workflowProvenanceDurationSeconds,
  workflowProvenanceEdgesTotal,
} from "../metrics";

export type ReasonTrace = {
  text: string;
  timestamp: number;
};

export type ExecContext = {
  ragDocumentIds?: string[];
};

export async function workflowProvenance(options: {
  resource: string;
  executionId: string;
  auto?: string;
  threadId?: string;
  traces: ReasonTrace[];
  context?: ExecContext | null;
}): Promise<void> {
  const { resource, executionId, auto, threadId, traces, context } = options;

  if (process.env.DISABLE_RUNTIME_PROVENANCE === "1") {
    return;
  }

  if (!traces.length) {
    return;
  }

  try {
    const stopTimer =
      process.env.DISABLE_TRPC_METRICS === "1"
        ? null
        : workflowProvenanceDurationSeconds.startTimer();

    const mod = await import(
      new URL("../../../agent/assistant/src/graphstore.ts", import.meta.url)
        .href
    );
    const { persistReasoning, linkRagProvenanceToReasoning } = mod as {
      persistReasoning: (
        resource: string,
        traces: ReasonTrace[],
        context?: {
          threadId?: string;
          executionId?: string;
          auto?: string;
          ragDocumentIds?: string[];
        }
      ) => Promise<void>;
      linkRagProvenanceToReasoning: (opts: {
        runtimeResource: string;
        executionId: string;
      }) => Promise<void>;
    };

    await persistReasoning(resource, traces, {
      threadId,
      executionId,
      auto,
      ragDocumentIds: context?.ragDocumentIds,
    });

    await linkRagProvenanceToReasoning({
      runtimeResource: resource,
      executionId,
    });

    try {
      workflowProvenanceEdgesTotal.inc({ outcome: "ok" });
    } catch {
      // ignore metric failures
    }

    if (stopTimer) {
      try {
        stopTimer({ outcome: "ok" });
      } catch {
        // ignore timer failures
      }
    }
  } catch (error) {
    logger.warn("workflow_provenance_failed", {
      resource,
      executionId,
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      workflowProvenanceEdgesTotal.inc({ outcome: "error" });
    } catch {
      // ignore metric failures
    }
  }
}
