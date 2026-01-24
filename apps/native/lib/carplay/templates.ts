/**
 * ALFRED CarPlay Templates
 *
 * Voice-first AI assistant templates for CarPlay.
 * Maps ALFRED's AI states to Apple's template-based UI.
 * Includes orchestrator-specific templates for workflow management.
 */

import type { VoiceControlState } from "react-native-carplay";
import {
  AlertTemplate,
  CarPlay,
  GridTemplate,
  InformationTemplate,
  ListTemplate,
  VoiceControlTemplate,
} from "react-native-carplay";
import type {
  Escalation,
  EscalationPriority,
  ExecPlan,
  PullRequest,
  WorkflowState,
} from "./types";

// Voice control states for the listening phase
const voiceStates: VoiceControlState[] = [
  {
    identifier: "idle",
    titleVariants: ["Tap to speak to Alfred"],
    repeats: false,
  },
  {
    identifier: "listening",
    titleVariants: ["Listening..."],
    repeats: true,
  },
  {
    identifier: "processing",
    titleVariants: ["Thinking..."],
    repeats: true,
  },
  {
    identifier: "speaking",
    titleVariants: ["Alfred is responding..."],
    repeats: true,
  },
  {
    identifier: "error",
    titleVariants: ["Something went wrong. Tap to try again."],
    repeats: false,
  },
];

// Create voice control template for listening phase
export function createVoiceTemplate(): VoiceControlTemplate {
  return new VoiceControlTemplate({
    voiceControlStates: voiceStates,
  });
}

// Create information template for displaying AI response
export function createResponseTemplate(
  response: string,
  onRepeat: () => void,
  onFollowUp: () => void
): InformationTemplate {
  // Truncate response for CarPlay (max 3-4 lines)
  const truncated =
    response.length > 200 ? `${response.substring(0, 197)}...` : response;

  return new InformationTemplate({
    title: "Alfred",
    items: [{ title: "Response", detail: truncated }],
    actions: [
      { id: "repeat", title: "Repeat" },
      { id: "followup", title: "Follow Up" },
      { id: "done", title: "Done" },
    ],
    onActionButtonPressed: (e) => {
      switch (e.id) {
        case "repeat":
          onRepeat();
          break;
        case "followup":
          onFollowUp();
          break;
        case "done":
          CarPlay.popTemplate();
          break;
      }
    },
  });
}

// Create list template for recent conversations/queries
export function createHistoryTemplate(
  items: Array<{ id: string; query: string; timestamp: Date }>,
  onSelect: (id: string) => void
): ListTemplate {
  return new ListTemplate({
    title: "Recent Queries",
    sections: [
      {
        header: "History",
        items: items.slice(0, 5).map((item) => ({
          text:
            item.query.length > 50
              ? `${item.query.substring(0, 47)}...`
              : item.query,
          detailText: formatTimeAgo(item.timestamp),
        })),
      },
    ],
    onItemSelect: async ({ index }) => {
      const selected = items[index];
      if (selected) {
        onSelect(selected.id);
      }
    },
  });
}

// CarPlay grid icons (80x80 recommended)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const VOICE_ICON = require("../../../assets/carplay/voice.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HISTORY_ICON = require("../../../assets/carplay/history.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const REMINDERS_ICON = require("../../../assets/carplay/reminders.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NOTES_ICON = require("../../../assets/carplay/notes.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _DECISIONS_ICON = require("../../../assets/carplay/decisions.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _PRS_ICON = require("../../../assets/carplay/prs.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _PLANS_ICON = require("../../../assets/carplay/plans.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WORKFLOW_RUNNING_ICON = require("../../../assets/carplay/workflow-running.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WORKFLOW_PAUSED_ICON = require("../../../assets/carplay/workflow-paused.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WORKFLOW_COMPLETE_ICON = require("../../../assets/carplay/workflow-complete.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WORKFLOW_FAILED_ICON = require("../../../assets/carplay/workflow-failed.png");

// Create main grid template (root template)
export function createMainTemplate(
  onVoice: () => void,
  onHistory: () => void,
  onReminders: () => void,
  onNotes: () => void
): GridTemplate {
  return new GridTemplate({
    title: "Alfred",
    buttons: [
      {
        id: "voice",
        titleVariants: ["Talk to Alfred"],
        image: VOICE_ICON,
      },
      {
        id: "history",
        titleVariants: ["Recent"],
        image: HISTORY_ICON,
      },
      {
        id: "reminders",
        titleVariants: ["Reminders"],
        image: REMINDERS_ICON,
      },
      {
        id: "notes",
        titleVariants: ["Notes"],
        image: NOTES_ICON,
      },
    ],
    onButtonPressed: (e) => {
      switch (e.id) {
        case "voice":
          onVoice();
          break;
        case "history":
          onHistory();
          break;
        case "reminders":
          onReminders();
          break;
        case "notes":
          onNotes();
          break;
      }
    },
  });
}

// Create offline mode template
export function createOfflineTemplate(): InformationTemplate {
  return new InformationTemplate({
    title: "Alfred - Offline",
    items: [
      { title: "Status", detail: "No internet connection" },
      { title: "Available", detail: "Notes, Reminders (view only)" },
    ],
    actions: [
      { id: "retry", title: "Retry Connection" },
      { id: "notes", title: "View Notes" },
      { id: "reminders", title: "View Reminders" },
    ],
    onActionButtonPressed: (_e) => {},
  });
}

// Create alert for errors
export function createErrorAlert(
  _message: string,
  onRetry: () => void,
  onDismiss: () => void
): AlertTemplate {
  return new AlertTemplate({
    titleVariants: ["Error"],
    actions: [
      { id: "retry", title: "Try Again" },
      { id: "dismiss", title: "Dismiss" },
    ],
    onActionButtonPressed: (e) => {
      if (e.id === "retry") {
        onRetry();
      } else {
        onDismiss();
      }
      CarPlay.dismissTemplate();
    },
  });
}

// Create reminders list template
export function createRemindersTemplate(
  reminders: Array<{ id: string; title: string; dueDate?: Date }>,
  onSelect: (id: string) => void
): ListTemplate {
  return new ListTemplate({
    title: "Reminders",
    emptyViewTitleVariants: ["No reminders"],
    emptyViewSubtitleVariants: ['Say "Remind me to..." to create one'],
    sections: [
      {
        header: "Upcoming",
        items: reminders.slice(0, 10).map((reminder) => ({
          text: reminder.title,
          detailText: reminder.dueDate
            ? formatDate(reminder.dueDate)
            : "No due date",
        })),
      },
    ],
    onItemSelect: async ({ index }) => {
      const selected = reminders[index];
      if (selected) {
        onSelect(selected.id);
      }
    },
    backButtonHidden: false,
  });
}

// Create notes list template
export function createNotesTemplate(
  notes: Array<{ id: string; title: string; preview: string }>,
  onSelect: (id: string) => void
): ListTemplate {
  return new ListTemplate({
    title: "Notes",
    emptyViewTitleVariants: ["No notes"],
    emptyViewSubtitleVariants: ['Say "Take a note..." to create one'],
    sections: [
      {
        header: "Recent Notes",
        items: notes.slice(0, 10).map((note) => ({
          text: note.title || "Untitled",
          detailText: note.preview.substring(0, 50),
        })),
      },
    ],
    onItemSelect: async ({ index }) => {
      const selected = notes[index];
      if (selected) {
        onSelect(selected.id);
      }
    },
    backButtonHidden: false,
  });
}

// Helper: Format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) {
    return "Just now";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86_400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return `${Math.floor(seconds / 86_400)}d ago`;
}

// Helper: Format date for display
function formatDate(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Helper: Truncate text
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 3)}...`;
}

// ============================================================================
// ORCHESTRATOR TEMPLATES - Workflow monitoring and control
// ============================================================================

// Create multi-agent grid showing workflow status (2x3 or 2x4 layout)
export function createAgentGridTemplate(
  workflows: WorkflowState[],
  onSelect: (workflow: WorkflowState) => void,
  onVoice: () => void
): GridTemplate {
  const buttons = workflows.slice(0, 7).map((w) => ({
    id: w.id,
    titleVariants: [truncate(w.requirement, 20)],
    image: getWorkflowStatusIcon(w.status),
  }));

  // Add "Talk to Alfred" button if room
  if (buttons.length < 8) {
    buttons.push({
      id: "voice",
      titleVariants: ["Talk to Alfred"],
      image: VOICE_ICON,
    });
  }

  return new GridTemplate({
    title: "Active Workflows",
    buttons,
    onButtonPressed: (e) => {
      if (e.id === "voice") {
        onVoice();
        return;
      }
      const selected = workflows.find((w) => w.id === e.id);
      if (selected) {
        onSelect(selected);
      }
    },
  });
}

// Create decision queue template (escalations sorted by priority)
export function createDecisionQueueTemplate(
  escalations: Escalation[],
  onSelect: (escalation: Escalation) => void
): ListTemplate {
  // Sort by priority: critical > high > normal
  const sorted = [...escalations].sort((a, b) => {
    const order: Record<EscalationPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
    };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  return new ListTemplate({
    title: "Decisions",
    emptyViewTitleVariants: ["All caught up!"],
    emptyViewSubtitleVariants: ["No decisions pending"],
    sections: [
      {
        header: "Pending Decisions",
        items: sorted.slice(0, 10).map((e) => ({
          text: truncate(e.question, 40),
          detailText: `${e.priority.toUpperCase()} • ${e.workflowName}`,
          image: getPriorityIcon(e.priority),
        })),
      },
    ],
    onItemSelect: async ({ index }) => {
      const selected = sorted[index];
      if (selected) {
        onSelect(selected);
      }
    },
  });
}

// Create PR list template
export function createPRListTemplate(
  pullRequests: PullRequest[],
  onSelect: (pr: PullRequest) => void
): ListTemplate {
  // Filter to agent-created, open PRs
  const agentPRs = pullRequests.filter(
    (pr) => pr.isAgentCreated && pr.status === "open"
  );

  return new ListTemplate({
    title: "Pull Requests",
    emptyViewTitleVariants: ["No PRs to review"],
    emptyViewSubtitleVariants: ["Agent PRs will appear here"],
    sections: [
      {
        header: "Agent PRs",
        items: agentPRs.slice(0, 10).map((pr) => ({
          text: truncate(pr.title, 40),
          detailText: `#${pr.number} • +${pr.additions}/-${pr.deletions} • ${pr.ciStatus}`,
          image: getCIIcon(pr.ciStatus),
        })),
      },
    ],
    onItemSelect: async ({ index }) => {
      const selected = agentPRs[index];
      if (selected) {
        onSelect(selected);
      }
    },
  });
}

// Create workflow detail template
export function createWorkflowDetailTemplate(
  workflow: WorkflowState,
  onPause: () => void,
  onResume: () => void,
  onCancel: () => void,
  onBack: () => void
): InformationTemplate {
  const actions = [];

  if (workflow.status === "running") {
    actions.push({ id: "pause", title: "Pause" });
  } else if (workflow.status === "suspended") {
    actions.push({ id: "resume", title: "Resume" });
  }

  actions.push({ id: "cancel", title: "Cancel" });
  actions.push({ id: "back", title: "Back" });

  return new InformationTemplate({
    title: truncate(workflow.requirement, 30),
    items: [
      { title: "Status", detail: workflow.status.toUpperCase() },
      { title: "Progress", detail: `${workflow.progress}%` },
      {
        title: "Tasks",
        detail: `${workflow.completedTasks}/${workflow.totalTasks}`,
      },
      ...(workflow.currentTask
        ? [{ title: "Current", detail: truncate(workflow.currentTask, 30) }]
        : []),
    ],
    actions,
    onActionButtonPressed: (e) => {
      switch (e.id) {
        case "pause":
          onPause();
          break;
        case "resume":
          onResume();
          break;
        case "cancel":
          onCancel();
          break;
        case "back":
          onBack();
          break;
      }
    },
  });
}

// Create escalation detail template
export function createEscalationDetailTemplate(
  escalation: Escalation,
  onApprove: () => void,
  onReject: () => void,
  onDefer: () => void
): InformationTemplate {
  return new InformationTemplate({
    title: `${escalation.priority.toUpperCase()} Decision`,
    items: [
      { title: "Workflow", detail: escalation.workflowName },
      { title: "Question", detail: truncate(escalation.question, 100) },
      ...(escalation.suggestions?.length
        ? [
            {
              title: "Suggestion",
              detail: truncate(escalation.suggestions[0], 50),
            },
          ]
        : []),
    ],
    actions: [
      { id: "approve", title: "Approve" },
      { id: "reject", title: "Reject" },
      { id: "defer", title: "Defer" },
    ],
    onActionButtonPressed: (e) => {
      switch (e.id) {
        case "approve":
          onApprove();
          break;
        case "reject":
          onReject();
          break;
        case "defer":
          onDefer();
          break;
      }
      CarPlay.popTemplate();
    },
  });
}

// Create PR detail template
export function createPRDetailTemplate(
  pr: PullRequest,
  onApprove: () => void,
  onRequestChanges: () => void,
  onDefer: () => void
): InformationTemplate {
  return new InformationTemplate({
    title: `PR #${pr.number}`,
    items: [
      { title: "Title", detail: truncate(pr.title, 40) },
      { title: "Changes", detail: `+${pr.additions}/-${pr.deletions}` },
      { title: "CI", detail: pr.ciStatus.toUpperCase() },
      {
        title: "Review",
        detail: pr.reviewStatus.replace("_", " ").toUpperCase(),
      },
      { title: "Author", detail: pr.author },
    ],
    actions: [
      { id: "approve", title: "Approve & Merge" },
      { id: "changes", title: "Request Changes" },
      { id: "defer", title: "Review Later" },
    ],
    onActionButtonPressed: (e) => {
      switch (e.id) {
        case "approve":
          onApprove();
          break;
        case "changes":
          onRequestChanges();
          break;
        case "defer":
          onDefer();
          break;
      }
      CarPlay.popTemplate();
    },
  });
}

// Create plan approval template
export function createPlanApprovalTemplate(
  plan: ExecPlan,
  onApprove: () => void,
  onReject: () => void,
  onModify: () => void
): InformationTemplate {
  const phasesSummary =
    plan.phases.length === 1
      ? `1 phase, ${plan.subtaskCount} tasks`
      : `${plan.phases.length} phases, ${plan.subtaskCount} tasks`;

  return new InformationTemplate({
    title: "Approve Plan?",
    items: [
      { title: "Task", detail: truncate(plan.requirement, 50) },
      { title: "Scope", detail: phasesSummary },
      { title: "Est. Time", detail: `~${plan.estimatedTime} min` },
      { title: "Risk", detail: plan.riskLevel.toUpperCase() },
    ],
    actions: [
      { id: "approve", title: "Approve" },
      { id: "modify", title: "Modify Scope" },
      { id: "reject", title: "Reject" },
    ],
    onActionButtonPressed: (e) => {
      switch (e.id) {
        case "approve":
          onApprove();
          break;
        case "modify":
          onModify();
          break;
        case "reject":
          onReject();
          break;
      }
      CarPlay.popTemplate();
    },
  });
}

// Create escalation alert (for push notifications)
export function createEscalationAlert(
  escalation: Escalation,
  onApprove: () => void,
  onReject: () => void,
  onDefer: () => void
): AlertTemplate {
  return new AlertTemplate({
    titleVariants: [
      `${escalation.priority.toUpperCase()}: ${escalation.workflowName}`,
    ],
    actions: [
      { id: "approve", title: "Approve" },
      { id: "reject", title: "Reject" },
      { id: "defer", title: "Later" },
    ],
    onActionButtonPressed: (e) => {
      switch (e.id) {
        case "approve":
          onApprove();
          break;
        case "reject":
          onReject();
          break;
        case "defer":
          onDefer();
          break;
      }
      CarPlay.dismissTemplate();
    },
  });
}

// Helper: Get workflow status icon
function getWorkflowStatusIcon(status: WorkflowState["status"]) {
  switch (status) {
    case "running":
      return WORKFLOW_RUNNING_ICON;
    case "suspended":
      return WORKFLOW_PAUSED_ICON;
    case "completed":
      return WORKFLOW_COMPLETE_ICON;
    case "failed":
    case "cancelled":
      return WORKFLOW_FAILED_ICON;
    default:
      return WORKFLOW_RUNNING_ICON;
  }
}

// Helper: Get priority icon
function getPriorityIcon(priority: EscalationPriority) {
  switch (priority) {
    case "critical":
      return REMINDERS_ICON;
    case "high":
      return HISTORY_ICON;
    default:
      return NOTES_ICON;
  }
}

// Helper: Get CI status icon
function getCIIcon(status: string) {
  switch (status) {
    case "success":
      return NOTES_ICON;
    case "failure":
      return REMINDERS_ICON;
    case "running":
      return VOICE_ICON;
    default:
      return HISTORY_ICON;
  }
}
