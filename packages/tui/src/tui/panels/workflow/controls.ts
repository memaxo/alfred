/**
 * ALFRED TUI Workflow Controls
 *
 * Actions for managing workflows: cancel, pause, resume, retry.
 */

import type { Workflow, WorkflowStatus } from "../../subscriptions/workflow";
import { dim, inverse } from "../../typography";

// ─── Available Actions ───────────────────────────────────────────────────────

export type WorkflowAction = "cancel" | "pause" | "resume" | "retry" | "view";

export type ActionConfig = {
  key: string;
  label: string;
  description: string;
  availableFor: WorkflowStatus[];
};

const ACTION_CONFIGS: Record<WorkflowAction, ActionConfig> = {
  cancel: {
    key: "x",
    label: "Cancel",
    description: "Stop this workflow",
    availableFor: ["pending", "planning", "executing"],
  },
  pause: {
    key: "p",
    label: "Pause",
    description: "Pause execution",
    availableFor: ["executing"],
  },
  resume: {
    key: "r",
    label: "Resume",
    description: "Resume execution",
    availableFor: [], // Would need a "paused" status
  },
  retry: {
    key: "t",
    label: "Retry",
    description: "Retry failed workflow",
    availableFor: ["failed"],
  },
  view: {
    key: "v",
    label: "View",
    description: "View details",
    availableFor: [
      "pending",
      "planning",
      "executing",
      "completed",
      "failed",
      "cancelled",
    ],
  },
};

// ─── Action Availability ─────────────────────────────────────────────────────

export function getAvailableActions(workflow: Workflow): WorkflowAction[] {
  const actions: WorkflowAction[] = [];

  for (const [action, config] of Object.entries(ACTION_CONFIGS)) {
    if (config.availableFor.includes(workflow.status)) {
      actions.push(action as WorkflowAction);
    }
  }

  return actions;
}

export function isActionAvailable(
  workflow: Workflow,
  action: WorkflowAction
): boolean {
  const config = ACTION_CONFIGS[action];
  return config.availableFor.includes(workflow.status);
}

// ─── Action Rendering ────────────────────────────────────────────────────────

export function renderAction(action: WorkflowAction, enabled = true): string {
  const config = ACTION_CONFIGS[action];
  const keyStyle = enabled
    ? inverse(` ${config.key} `)
    : dim(`[${config.key}]`);
  const labelStyle = enabled ? config.label : dim(config.label);

  return `${keyStyle} ${labelStyle}`;
}

export function renderAvailableActions(workflow: Workflow): string {
  const actions = getAvailableActions(workflow);

  if (actions.length === 0) {
    return dim("No actions available");
  }

  return actions.map((a) => renderAction(a, true)).join("  ");
}

// ─── Control Bar ─────────────────────────────────────────────────────────────

export function renderControlBar(
  selectedWorkflow: Workflow | null,
  _width: number
): string[] {
  const lines: string[] = [];

  if (!selectedWorkflow) {
    lines.push(dim("Select a workflow to see available actions"));
    return lines;
  }

  lines.push(dim("Actions:"));
  lines.push(`  ${renderAvailableActions(selectedWorkflow)}`);

  return lines;
}

// ─── Confirmation Dialogs ────────────────────────────────────────────────────

export type ActionConfirmation = {
  action: WorkflowAction;
  workflow: Workflow;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

export function createCancelConfirmation(
  workflow: Workflow
): ActionConfirmation {
  return {
    action: "cancel",
    workflow,
    message: `Cancel workflow "${workflow.name}"?`,
    confirmLabel: "Yes, cancel",
    cancelLabel: "No, keep running",
  };
}

export function createRetryConfirmation(
  workflow: Workflow
): ActionConfirmation {
  return {
    action: "retry",
    workflow,
    message: `Retry failed workflow "${workflow.name}"?`,
    confirmLabel: "Yes, retry",
    cancelLabel: "No",
  };
}

// ─── Action Execution ────────────────────────────────────────────────────────

export type ActionHandler = {
  cancel: (workflowId: string) => Promise<void>;
  pause: (workflowId: string) => Promise<void>;
  resume: (workflowId: string) => Promise<void>;
  retry: (workflowId: string) => Promise<void>;
  view: (workflowId: string) => void;
};

export function createActionExecutor(
  handlers: Partial<ActionHandler>
): (action: WorkflowAction, workflow: Workflow) => Promise<void> {
  return async (action: WorkflowAction, workflow: Workflow) => {
    const handler = handlers[action];
    if (handler) {
      await handler(workflow.id);
    }
  };
}

// ─── Keyboard Handler ────────────────────────────────────────────────────────

export function getActionForKey(key: string): WorkflowAction | null {
  for (const [action, config] of Object.entries(ACTION_CONFIGS)) {
    if (config.key === key) {
      return action as WorkflowAction;
    }
  }
  return null;
}

export function renderControlHints(): string {
  const hints = [
    { key: "x", desc: "Cancel" },
    { key: "v", desc: "View" },
    { key: "t", desc: "Retry" },
    { key: "Enter", desc: "Select" },
  ];

  return hints.map((h) => `${inverse(` ${h.key} `)} ${dim(h.desc)}`).join("  ");
}
