/**
 * CarPlay Voice Handlers
 *
 * Handles voice commands for CarPlay orchestrator interactions.
 * Wires to existing ALFRED tRPC endpoints for workflow management.
 *
 * This is a BRIDGE - it routes voice intents to existing handlers:
 * - packages/api/src/voice/workflow-handler.ts
 * - packages/api/src/routers/workflow.ts
 * - packages/api/src/routers/review.ts
 *
 * NOTE: Some API calls are stubbed out. The actual endpoints will be
 * wired when the backend escalation/control APIs are finalized.
 */

import type { Escalation } from "../types";

import { useCarPlayStore } from "../store";
import {
  speakConfirmation,
  speakDecisionQueueSummary,
  speakError,
  speakEscalation,
  speakPlanSummary,
  speakPRSummary,
  speakWorkflowStatus,
  speakWorkflowUpdate,
} from "./speech";

export type VoiceHandlerResult = {
  text: string;
  success: boolean;
  data?: unknown;
};

/**
 * Handle status query - "what's the status?"
 */
export async function handleStatusQuery(
  workflowId?: string
): Promise<VoiceHandlerResult> {
  try {
    const store = useCarPlayStore.getState();

    if (workflowId) {
      const workflow = store.workflows.get(workflowId);
      if (!workflow) {
        return {
          text: "I couldn't find that workflow.",
          success: false,
        };
      }
      return {
        text: speakWorkflowStatus([workflow]),
        success: true,
        data: workflow,
      };
    }

    const running = store.getRunningWorkflows();
    return {
      text: speakWorkflowStatus(running),
      success: true,
      data: running,
    };
  } catch (_error) {
    return {
      text: speakError("checking status"),
      success: false,
    };
  }
}

/**
 * Handle decision queue query - "what needs my attention?"
 */
export async function handleDecisionQuery(): Promise<VoiceHandlerResult> {
  try {
    const store = useCarPlayStore.getState();
    const escalations = store.escalations;
    const reviewCount = store.reviews.length;

    return {
      text: speakDecisionQueueSummary(escalations, reviewCount),
      success: true,
      data: { escalations, reviewCount },
    };
  } catch (_error) {
    return {
      text: speakError("checking decisions"),
      success: false,
    };
  }
}

/**
 * Handle escalation decision - "approve", "reject", "defer"
 */
export async function handleEscalationDecision(
  escalationId: string,
  action: "approve" | "reject" | "defer"
): Promise<VoiceHandlerResult> {
  try {
    const store = useCarPlayStore.getState();

    const escalation = store.escalations.find((e) => e.id === escalationId);
    if (!escalation) {
      return {
        text: "I couldn't find that escalation.",
        success: false,
      };
    }

    if (action === "defer") {
      store.removeEscalation(escalationId);
      return {
        text: speakConfirmation("deferred", escalation.workflowName),
        success: true,
      };
    }

    // TODO: Wire to actual escalation resolution API when available
    // await client.workflow.resolveEscalation({ runId, escalationId, decision });
    store.removeEscalation(escalationId);

    return {
      text: speakConfirmation(
        action === "approve" ? "approved" : "rejected",
        escalation.workflowName
      ),
      success: true,
    };
  } catch (_error) {
    return {
      text: speakError("handling decision"),
      success: false,
    };
  }
}

/**
 * Handle PR decision - "approve", "defer"
 */
export async function handlePRDecision(
  prId: string,
  action: "approve" | "defer" | "changes"
): Promise<VoiceHandlerResult> {
  try {
    const store = useCarPlayStore.getState();

    const pr = store.pullRequests.find((p) => p.id === prId);
    if (!pr) {
      return {
        text: "I couldn't find that pull request.",
        success: false,
      };
    }

    if (action === "defer") {
      return {
        text: speakConfirmation("deferred", `PR ${pr.number}`),
        success: true,
      };
    }

    if (action === "approve") {
      // TODO: Wire to actual PR approval API when available
      // await client.github.approvePR({ owner, repo, pullNumber, merge: true });
      store.removePullRequest(prId);

      return {
        text: speakConfirmation("approved", `PR ${pr.number}`),
        success: true,
      };
    }

    return {
      text: "To request changes, please use the app to leave a comment.",
      success: false,
    };
  } catch (_error) {
    return {
      text: speakError("handling PR"),
      success: false,
    };
  }
}

/**
 * Handle plan approval - "approve", "reject", "modify"
 */
export async function handlePlanDecision(
  planId: string,
  action: "approve" | "reject" | "modify"
): Promise<VoiceHandlerResult> {
  try {
    const store = useCarPlayStore.getState();

    const plan = store.pendingPlans.find((p) => p.id === planId);
    if (!plan) {
      return {
        text: "I couldn't find that plan.",
        success: false,
      };
    }

    if (action === "modify") {
      return {
        text: "To modify the plan, please describe what you want to change.",
        success: false,
      };
    }

    // TODO: Wire to actual plan status update API
    // await client.plan.updateStatus({ planId, status });
    store.removePendingPlan(planId);

    if (action === "approve") {
      return {
        text: `${speakConfirmation("approved", plan.requirement)} Agents are now executing.`,
        success: true,
      };
    }

    return {
      text: speakConfirmation("rejected", plan.requirement),
      success: true,
    };
  } catch (_error) {
    return {
      text: speakError("handling plan"),
      success: false,
    };
  }
}

/**
 * Handle workflow control - "pause", "resume", "cancel"
 */
export async function handleWorkflowControl(
  workflowId: string,
  action: "pause" | "resume" | "cancel"
): Promise<VoiceHandlerResult> {
  try {
    const store = useCarPlayStore.getState();

    const workflow = store.workflows.get(workflowId);
    if (!workflow) {
      return {
        text: "I couldn't find that workflow.",
        success: false,
      };
    }

    // TODO: Wire to actual workflow control APIs when available
    // await client.workflow.pause/resume/cancel({ runId });

    switch (action) {
      case "pause":
        store.updateWorkflow(workflowId, { status: "suspended" });
        return {
          text: speakConfirmation("paused", workflow.requirement),
          success: true,
        };

      case "resume":
        store.updateWorkflow(workflowId, { status: "running" });
        return {
          text: speakConfirmation("resumed", workflow.requirement),
          success: true,
        };

      case "cancel":
        store.updateWorkflow(workflowId, { status: "cancelled" });
        return {
          text: speakConfirmation("cancelled", workflow.requirement),
          success: true,
        };
    }
  } catch (_error) {
    return {
      text: speakError(`${action} workflow`),
      success: false,
    };
  }
}

/**
 * Get the next item from decision queue and speak it.
 */
export async function speakNextDecision(): Promise<VoiceHandlerResult> {
  const store = useCarPlayStore.getState();
  const queue = store.getDecisionQueue();

  if (queue.length === 0) {
    return {
      text: "No pending decisions. All caught up.",
      success: true,
    };
  }

  const next = queue[0]!;

  // Check if it's an escalation or review
  if ("question" in next) {
    // Escalation
    return {
      text: speakEscalation(next as Escalation),
      success: true,
      data: next,
    };
  }

  // Review item - treat as a simplified escalation
  return {
    text: `Review needed: ${next.title}. Say approve or defer.`,
    success: true,
    data: next,
  };
}

/**
 * Speak details about a specific workflow.
 */
export async function speakWorkflowDetails(
  workflowId: string
): Promise<VoiceHandlerResult> {
  const store = useCarPlayStore.getState();
  const workflow = store.workflows.get(workflowId);

  if (!workflow) {
    return {
      text: "I couldn't find that workflow.",
      success: false,
    };
  }

  const event =
    workflow.status === "running"
      ? "progress"
      : workflow.status === "completed"
        ? "completed"
        : workflow.status === "failed"
          ? "failed"
          : workflow.status === "suspended"
            ? "paused"
            : "progress";

  return {
    text: speakWorkflowUpdate(workflow, event),
    success: true,
    data: workflow,
  };
}

/**
 * Speak details about a specific PR.
 */
export async function speakPRDetails(
  prId: string
): Promise<VoiceHandlerResult> {
  const store = useCarPlayStore.getState();
  const pr = store.pullRequests.find((p) => p.id === prId);

  if (!pr) {
    return {
      text: "I couldn't find that pull request.",
      success: false,
    };
  }

  return {
    text: speakPRSummary(pr),
    success: true,
    data: pr,
  };
}

/**
 * Speak details about a specific plan.
 */
export async function speakPlanDetails(
  planId: string
): Promise<VoiceHandlerResult> {
  const store = useCarPlayStore.getState();
  const plan = store.pendingPlans.find((p) => p.id === planId);

  if (!plan) {
    return {
      text: "I couldn't find that plan.",
      success: false,
    };
  }

  return {
    text: speakPlanSummary(plan),
    success: true,
    data: plan,
  };
}
