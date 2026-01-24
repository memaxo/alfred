/**
 * ALFRED CarPlay Dashboard Scene
 *
 * Main dashboard for CarPlay with workflow status widget.
 * Provides quick access to voice, decisions, PRs, and status.
 */

import {
  CarPlay,
  GridTemplate,
  ListTemplate,
  TabBarTemplate,
} from "react-native-carplay";
import { useCarPlayStore } from "../store";
import type {
  Escalation,
  ExecPlan,
  PullRequest,
  WorkflowState,
} from "../types";

// Icon assets (80x80 @3x recommended)
const ICONS = {
  voice: require("../../../../assets/carplay/voice.png"),
  status: require("../../../../assets/carplay/history.png"),
  decisions: require("../../../../assets/carplay/decisions.png"),
  prs: require("../../../../assets/carplay/prs.png"),
  plans: require("../../../../assets/carplay/plans.png"),
  running: require("../../../../assets/carplay/workflow-running.png"),
  blocked: require("../../../../assets/carplay/workflow-paused.png"),
  complete: require("../../../../assets/carplay/workflow-complete.png"),
  failed: require("../../../../assets/carplay/workflow-failed.png"),
};

export type DashboardCallbacks = {
  onVoice: () => void;
  onWorkflowSelect: (workflow: WorkflowState) => void;
  onEscalationSelect: (escalation: Escalation) => void;
  onPRSelect: (pr: PullRequest) => void;
  onPlanSelect: (plan: ExecPlan) => void;
};

// Create the main TabBar dashboard
export function createDashboardTemplate(
  callbacks: DashboardCallbacks
): TabBarTemplate {
  const _store = useCarPlayStore.getState();

  // Create tabs
  const statusTab = createStatusTab(callbacks);
  const decisionsTab = createDecisionsTab(callbacks);
  const prsTab = createPRsTab(callbacks);
  const voiceTab = createVoiceTab(callbacks);

  return new TabBarTemplate({
    templates: [statusTab, decisionsTab, prsTab, voiceTab],
    onTemplateSelect: (_template, _index) => {},
  });
}

// Status tab: Shows running workflows
function createStatusTab(callbacks: DashboardCallbacks): ListTemplate {
  const store = useCarPlayStore.getState();
  const workflows = store.getRunningWorkflows();

  const items = workflows.slice(0, 8).map((w) => ({
    text: truncate(w.requirement, 40),
    detailText: `${w.status} • ${w.progress}%`,
    image: getWorkflowIcon(w.status),
  }));

  // Add "Talk to Alfred" as first item if no workflows
  if (items.length === 0) {
    items.push({
      text: "No active workflows",
      detailText: 'Say "Start a new task" to begin',
      image: ICONS.voice,
    });
  }

  return new ListTemplate({
    title: "Status",
    tabTitle: "Status",
    tabSystemItem: 0, // featured
    sections: [
      {
        header: "Active Workflows",
        items,
      },
    ],
    onItemSelect: async ({ index }) => {
      if (workflows.length === 0) {
        callbacks.onVoice();
        return;
      }
      const selected = workflows[index];
      if (selected) {
        callbacks.onWorkflowSelect(selected);
      }
    },
  });
}

// Decisions tab: Escalations + Reviews sorted by priority
function createDecisionsTab(callbacks: DashboardCallbacks): ListTemplate {
  const store = useCarPlayStore.getState();
  const queue = store.getDecisionQueue();
  const count = store.getDecisionCount();

  const items = queue.slice(0, 10).map((item) => {
    const isEscalation = "workflowId" in item;
    return {
      text: truncate(
        isEscalation ? (item as Escalation).question : item.title,
        40
      ),
      detailText: `${item.priority.toUpperCase()} • ${isEscalation ? "Escalation" : "Review"}`,
      image: getPriorityIcon(item.priority),
    };
  });

  if (items.length === 0) {
    items.push({
      text: "All caught up!",
      detailText: "No decisions pending",
      image: ICONS.complete,
    });
  }

  return new ListTemplate({
    title: "Decisions",
    tabTitle: count > 0 ? `Decisions (${count})` : "Decisions",
    tabSystemItem: 1, // more
    sections: [
      {
        header: "Pending Decisions",
        items,
      },
    ],
    onItemSelect: async ({ index }) => {
      const selected = queue[index];
      if (selected && "workflowId" in selected) {
        callbacks.onEscalationSelect(selected as Escalation);
      }
    },
  });
}

// PRs tab: Agent-created PRs ready for review
function createPRsTab(callbacks: DashboardCallbacks): ListTemplate {
  const store = useCarPlayStore.getState();
  const prs = store.pullRequests.filter(
    (pr) => pr.isAgentCreated && pr.status === "open"
  );
  const count = store.getPRCount();

  const items = prs.slice(0, 10).map((pr) => ({
    text: truncate(pr.title, 40),
    detailText: `#${pr.number} • +${pr.additions}/-${pr.deletions}`,
    image: getCIStatusIcon(pr.ciStatus),
  }));

  if (items.length === 0) {
    items.push({
      text: "No PRs to review",
      detailText: "Agent PRs will appear here",
      image: ICONS.complete,
    });
  }

  return new ListTemplate({
    title: "Pull Requests",
    tabTitle: count > 0 ? `PRs (${count})` : "PRs",
    tabSystemItem: 2, // downloads
    sections: [
      {
        header: "Agent PRs",
        items,
      },
    ],
    onItemSelect: async ({ index }) => {
      const selected = prs[index];
      if (selected) {
        callbacks.onPRSelect(selected);
      }
    },
  });
}

// Voice tab: Quick actions grid
function createVoiceTab(callbacks: DashboardCallbacks): GridTemplate {
  const store = useCarPlayStore.getState();
  const planCount = store.getPlanCount();

  const buttons = [
    {
      id: "talk",
      titleVariants: ["Talk to Alfred"],
      image: ICONS.voice,
    },
    {
      id: "status",
      titleVariants: ["Current Status"],
      image: ICONS.status,
    },
  ];

  // Add pending plans button if any
  if (planCount > 0) {
    buttons.push({
      id: "plans",
      titleVariants: [`Plans (${planCount})`],
      image: ICONS.decisions,
    });
  }

  return new GridTemplate({
    title: "Voice",
    tabTitle: "Voice",
    tabSystemItem: 3, // search
    buttons,
    onButtonPressed: (e) => {
      switch (e.id) {
        case "talk":
          callbacks.onVoice();
          break;
        case "status":
          // Speak current status
          callbacks.onVoice();
          break;
        case "plans": {
          const plans = store.pendingPlans;
          if (plans[0]) {
            callbacks.onPlanSelect(plans[0]);
          }
          break;
        }
      }
    },
  });
}

// Update dashboard with latest data (call after sync)
export function refreshDashboard(callbacks: DashboardCallbacks): void {
  const template = createDashboardTemplate(callbacks);
  CarPlay.setRootTemplate(template);
}

// Get status icon based on workflow state
function getWorkflowIcon(status: WorkflowState["status"]) {
  switch (status) {
    case "running":
      return ICONS.running;
    case "suspended":
      return ICONS.blocked;
    case "completed":
      return ICONS.complete;
    case "failed":
      return ICONS.blocked;
    default:
      return ICONS.status;
  }
}

// Get icon based on priority
function getPriorityIcon(priority: string) {
  switch (priority) {
    case "critical":
      return ICONS.blocked;
    case "high":
      return ICONS.decisions;
    default:
      return ICONS.status;
  }
}

// Get icon based on CI status
function getCIStatusIcon(status: string) {
  switch (status) {
    case "success":
      return ICONS.complete;
    case "failure":
      return ICONS.blocked;
    case "running":
      return ICONS.running;
    default:
      return ICONS.status;
  }
}

// Truncate text for CarPlay display
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 3)}...`;
}
