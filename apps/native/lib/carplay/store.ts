/**
 * ALFRED CarPlay State Store
 *
 * Zustand store for CarPlay state management.
 * Manages workflows, escalations, PRs, plans, and connection status.
 */

import { create } from "zustand";

import type {
  ConnectionStatus,
  Escalation,
  EscalationPriority,
  ExecPlan,
  OfflineCommand,
  PullRequest,
  ReviewItem,
  WorkflowState,
} from "./types";

interface CarPlayStore {
  // Connection
  connectionStatus: ConnectionStatus;
  lastSyncAt: number | null;

  // Workflows
  workflows: Map<string, WorkflowState>;
  activeWorkflowId: string | null;

  // Decision queue (escalations + reviews)
  escalations: Escalation[];
  reviews: ReviewItem[];

  // PRs ready for review
  pullRequests: PullRequest[];

  // Plans awaiting approval
  pendingPlans: ExecPlan[];

  // UI state
  isVoiceActive: boolean;
  isTTSSpeaking: boolean;
  voiceStatus: "idle" | "listening" | "processing" | "speaking" | "error";

  // Offline queue
  offlineCommands: OfflineCommand[];

  // Actions - Connection
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastSyncAt: (timestamp: number) => void;

  // Actions - Workflows
  setWorkflows: (workflows: WorkflowState[]) => void;
  updateWorkflow: (id: string, update: Partial<WorkflowState>) => void;
  removeWorkflow: (id: string) => void;
  setActiveWorkflow: (id: string | null) => void;

  // Actions - Escalations
  setEscalations: (escalations: Escalation[]) => void;
  addEscalation: (escalation: Escalation) => void;
  removeEscalation: (id: string) => void;

  // Actions - Reviews
  setReviews: (reviews: ReviewItem[]) => void;
  addReview: (review: ReviewItem) => void;
  removeReview: (id: string) => void;

  // Actions - PRs
  setPullRequests: (prs: PullRequest[]) => void;
  updatePullRequest: (id: string, update: Partial<PullRequest>) => void;
  removePullRequest: (id: string) => void;

  // Actions - Plans
  setPendingPlans: (plans: ExecPlan[]) => void;
  addPendingPlan: (plan: ExecPlan) => void;
  removePendingPlan: (id: string) => void;

  // Actions - UI
  setVoiceActive: (active: boolean) => void;
  setTTSSpeaking: (speaking: boolean) => void;
  setVoiceStatus: (
    status: "idle" | "listening" | "processing" | "speaking" | "error"
  ) => void;

  // Actions - Offline
  addOfflineCommand: (command: OfflineCommand) => void;
  removeOfflineCommand: (id: string) => void;
  clearOfflineCommands: () => void;
  getOfflineCommandCount: () => number;

  // Computed - get sorted decision queue
  getDecisionQueue: () => (Escalation | ReviewItem)[];

  // Computed - get active workflows
  getRunningWorkflows: () => WorkflowState[];

  // Computed - badge counts
  getDecisionCount: () => number;
  getPRCount: () => number;
  getPlanCount: () => number;

  // Reset
  reset: () => void;
}

// Priority sort order
const priorityOrder: Record<EscalationPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
};

export const useCarPlayStore = create<CarPlayStore>((set, get) => ({
  // Initial state
  connectionStatus: "disconnected",
  lastSyncAt: null,
  workflows: new Map(),
  activeWorkflowId: null,
  escalations: [],
  reviews: [],
  pullRequests: [],
  pendingPlans: [],
  isVoiceActive: false,
  isTTSSpeaking: false,
  voiceStatus: "idle",
  offlineCommands: [],

  // Connection actions
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

  // Workflow actions
  setWorkflows: (workflows) => {
    const map = new Map<string, WorkflowState>();
    for (const w of workflows) {
      map.set(w.id, w);
    }
    set({ workflows: map });
  },

  updateWorkflow: (id, update) => {
    const { workflows } = get();
    const existing = workflows.get(id);
    if (existing) {
      const updated = new Map(workflows);
      updated.set(id, { ...existing, ...update, updatedAt: Date.now() });
      set({ workflows: updated });
    } else {
      // New workflow
      const updated = new Map(workflows);
      updated.set(id, {
        id,
        requirement: update.requirement ?? "",
        status: update.status ?? "running",
        progress: update.progress ?? 0,
        completedTasks: update.completedTasks ?? 0,
        totalTasks: update.totalTasks ?? 0,
        startedAt: update.startedAt ?? Date.now(),
        updatedAt: Date.now(),
        ...update,
      });
      set({ workflows: updated });
    }
  },

  removeWorkflow: (id) => {
    const { workflows, activeWorkflowId } = get();
    const updated = new Map(workflows);
    updated.delete(id);
    set({
      workflows: updated,
      activeWorkflowId: activeWorkflowId === id ? null : activeWorkflowId,
    });
  },

  setActiveWorkflow: (id) => set({ activeWorkflowId: id }),

  // Escalation actions
  setEscalations: (escalations) => set({ escalations }),

  addEscalation: (escalation) => {
    const { escalations } = get();
    // Avoid duplicates
    if (escalations.some((e) => e.id === escalation.id)) {
      return;
    }
    set({ escalations: [...escalations, escalation] });
  },

  removeEscalation: (id) => {
    const { escalations } = get();
    set({ escalations: escalations.filter((e) => e.id !== id) });
  },

  // Review actions
  setReviews: (reviews) => set({ reviews }),

  addReview: (review) => {
    const { reviews } = get();
    if (reviews.some((r) => r.id === review.id)) {
      return;
    }
    set({ reviews: [...reviews, review] });
  },

  removeReview: (id) => {
    const { reviews } = get();
    set({ reviews: reviews.filter((r) => r.id !== id) });
  },

  // PR actions
  setPullRequests: (prs) => set({ pullRequests: prs }),

  updatePullRequest: (id, update) => {
    const { pullRequests } = get();
    set({
      pullRequests: pullRequests.map((pr) =>
        pr.id === id ? { ...pr, ...update } : pr
      ),
    });
  },

  removePullRequest: (id) => {
    const { pullRequests } = get();
    set({ pullRequests: pullRequests.filter((pr) => pr.id !== id) });
  },

  // Plan actions
  setPendingPlans: (plans) => set({ pendingPlans: plans }),

  addPendingPlan: (plan) => {
    const { pendingPlans } = get();
    if (pendingPlans.some((p) => p.id === plan.id)) {
      return;
    }
    set({ pendingPlans: [...pendingPlans, plan] });
  },

  removePendingPlan: (id) => {
    const { pendingPlans } = get();
    set({ pendingPlans: pendingPlans.filter((p) => p.id !== id) });
  },

  // UI actions
  setVoiceActive: (active) => set({ isVoiceActive: active }),
  setTTSSpeaking: (speaking) => set({ isTTSSpeaking: speaking }),
  setVoiceStatus: (status) =>
    set({
      voiceStatus: status,
      isVoiceActive: status !== "idle" && status !== "error",
    }),

  // Offline actions
  addOfflineCommand: (command) => {
    const { offlineCommands } = get();
    if (offlineCommands.some((c) => c.id === command.id)) {
      return;
    }
    set({ offlineCommands: [...offlineCommands, command] });
  },

  removeOfflineCommand: (id) => {
    const { offlineCommands } = get();
    set({ offlineCommands: offlineCommands.filter((c) => c.id !== id) });
  },

  clearOfflineCommands: () => set({ offlineCommands: [] }),

  getOfflineCommandCount: () => {
    const { offlineCommands } = get();
    return offlineCommands.length;
  },

  // Computed: sorted decision queue (escalations + reviews by priority)
  getDecisionQueue: () => {
    const { escalations, reviews } = get();

    // Combine and sort by priority
    const combined: (Escalation | ReviewItem)[] = [
      ...escalations,
      ...reviews.map((r) => ({
        ...r,
        priority: r.priority as EscalationPriority,
      })),
    ];

    return combined.sort((a, b) => {
      const aPriority = priorityOrder[a.priority] ?? 2;
      const bPriority = priorityOrder[b.priority] ?? 2;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      // Secondary sort by creation time (oldest first)
      const aTime =
        "createdAt" in a
          ? typeof a.createdAt === "number"
            ? a.createdAt
            : new Date(a.createdAt).getTime()
          : 0;
      const bTime =
        "createdAt" in b
          ? typeof b.createdAt === "number"
            ? b.createdAt
            : new Date(b.createdAt).getTime()
          : 0;
      return aTime - bTime;
    });
  },

  // Computed: running workflows
  getRunningWorkflows: () => {
    const { workflows } = get();
    const running: WorkflowState[] = [];
    for (const w of workflows.values()) {
      if (w.status === "running" || w.status === "suspended") {
        running.push(w);
      }
    }
    return running.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  // Computed: badge counts
  getDecisionCount: () => {
    const { escalations, reviews } = get();
    return escalations.length + reviews.length;
  },

  getPRCount: () => {
    const { pullRequests } = get();
    return pullRequests.filter(
      (pr) => pr.status === "open" && pr.isAgentCreated
    ).length;
  },

  getPlanCount: () => {
    const { pendingPlans } = get();
    return pendingPlans.length;
  },

  // Reset store
  reset: () =>
    set({
      connectionStatus: "disconnected",
      lastSyncAt: null,
      workflows: new Map(),
      activeWorkflowId: null,
      escalations: [],
      reviews: [],
      pullRequests: [],
      pendingPlans: [],
      isVoiceActive: false,
      isTTSSpeaking: false,
      voiceStatus: "idle",
      offlineCommands: [],
    }),
}));

// Selector hooks for common patterns
export const useConnectionStatus = () =>
  useCarPlayStore((s) => s.connectionStatus);
export const useWorkflows = () => useCarPlayStore((s) => s.workflows);
export const useActiveWorkflow = () => {
  const workflows = useCarPlayStore((s) => s.workflows);
  const activeId = useCarPlayStore((s) => s.activeWorkflowId);
  return activeId ? workflows.get(activeId) : undefined;
};
export const useDecisionCount = () =>
  useCarPlayStore((s) => s.getDecisionCount());
export const usePRCount = () => useCarPlayStore((s) => s.getPRCount());
export const usePlanCount = () => useCarPlayStore((s) => s.getPlanCount());
