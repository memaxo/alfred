import { logger } from "@alfred/metrics";
import { emitLinearActivity } from "../linear";
import type { AlfredCodexEvent, CodexToolInput } from "./codex";

let codexLinearIntegrationLatencySeconds:
  | {
      startTimer: (labels: { event_type: string }) => () => void;
    }
  | undefined;

export function configureCodexLinearMetrics(histogram: {
  startTimer: (labels: { event_type: string }) => () => void;
}): void {
  codexLinearIntegrationLatencySeconds = histogram;
}

// Pure helper to inject Linear context into the prompt
export function injectLinearContext(
  prompt: string,
  context: CodexToolInput["context"]
): string {
  if (!context?.linearIssueId) {
    return prompt;
  }

  const issueId = context.linearIssueId;
  const issueUrl = `https://linear.app/issue/${issueId}`;

  return `[Context: Linear Issue ${issueId}]
You are working on Linear issue ${issueId}.
Issue URL: ${issueUrl}

${prompt}`;
}

// Pure helper to map Codex events to Linear activities
export async function mapCodexEventToLinearActivity(
  event: AlfredCodexEvent,
  context: NonNullable<CodexToolInput["context"]>
): Promise<void> {
  const { linearSessionId, linearSpace, linearAuthz } = context;

  if (!(linearSessionId && linearSpace && linearAuthz)) {
    return;
  }

  const stopTimer = codexLinearIntegrationLatencySeconds?.startTimer({
    event_type: event.type,
  });

  try {
    switch (event.type) {
      case "thought":
        await emitLinearActivity("thought", {
          sessionId: linearSessionId,
          space: linearSpace,
          authz: linearAuthz,
          body: event.content,
        });
        break;
      case "command":
        // Only emit completed or failed commands to reduce noise
        if (event.status !== "running") {
          await emitLinearActivity("action", {
            sessionId: linearSessionId,
            space: linearSpace,
            authz: linearAuthz,
            title: `Ran command: ${event.command}`,
            body: `Status: ${event.status}`,
            ephemeral: true,
          });
        }
        break;
      case "output":
        // Output is usually too verbose for Linear activities; skip or aggregate?
        // For now, we skip raw output to keep Linear clean.
        break;
      case "artifact":
        await emitLinearActivity("action", {
          sessionId: linearSessionId,
          space: linearSpace,
          authz: linearAuthz,
          title: `Created artifact: ${event.path}`,
          body: `Type: ${event.kind}`,
          ephemeral: true,
        });
        break;
      default:
        // Ignore unknown event types
        break;
    }
  } catch (error) {
    // Non-fatal: log and continue
    logger.warn("linear_activity_failed_codex_event", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    stopTimer?.();
  }
}
