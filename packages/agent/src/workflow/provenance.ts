import { logger } from "@alfred/logger";

import {
  workflowProvenanceDurationSeconds,
  workflowProvenanceEdgesTotal,
} from "./metrics";

export interface ReasonTrace {
  text: string;
  timestamp: number;
}

export interface ExecContext {
  ragDocumentIds?: string[];
}

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
    const projectId = await (async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }
      try {
        const workflowRepo = await import("@alfred/db/repo/workflow");
        const run = await workflowRepo.getRun(executionId);
        return run?.projectId ?? undefined;
      } catch {
        return;
      }
    })();

    const stopTimer =
      process.env.DISABLE_TRPC_METRICS === "1"
        ? null
        : workflowProvenanceDurationSeconds.startTimer();

    // Import from the same package (agent) but different module
    const mod = await import("../../assistant/src/graphstore");
    const { persistReasoning, linkRagProvenanceToReasoning } = mod;

    await persistReasoning(resource, traces, {
      threadId,
      executionId,
      auto,
      ragDocumentIds: context?.ragDocumentIds,
      projectId,
    });

    await linkRagProvenanceToReasoning({
      runtimeResource: resource,
      executionId,
      projectId,
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
