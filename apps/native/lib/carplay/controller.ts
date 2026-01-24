/**
 * ALFRED CarPlay Controller
 *
 * Main controller for CarPlay integration.
 * Manages connection state, template navigation, voice interactions,
 * and orchestrator workflows (escalations, PRs, plans).
 *
 * Integrates with:
 * - CarPlay store for state management
 * - Voice bridge for STT/TTS via existing ALFRED voice system
 * - Sync manager for real-time workflow updates
 * - Dashboard and orchestrator templates
 */

import type { WindowInformation } from "react-native-carplay";

import { CarPlay } from "react-native-carplay";

import type { Escalation, ExecPlan, PullRequest, WorkflowState } from "./types";

import { setTrpcClient } from "./api";
import { carPlayAudio } from "./audio";
import {
  createDashboardTemplate,
  type DashboardCallbacks,
  refreshDashboard,
} from "./scenes/dashboard";
import { useCarPlayStore } from "./store";
import { carPlaySync } from "./sync";
import {
  createErrorAlert,
  createEscalationAlert,
  createEscalationDetailTemplate,
  createHistoryTemplate,
  createMainTemplate,
  createNotesTemplate,
  createOfflineTemplate,
  createPlanApprovalTemplate,
  createPRDetailTemplate,
  createRemindersTemplate,
  createResponseTemplate,
  createVoiceTemplate,
  createWorkflowDetailTemplate,
} from "./templates";
import {
  playConfirmationCue,
  playErrorCue,
  playListeningCue,
  playNotificationCue,
} from "./voice/cues";
import {
  handleDecisionQuery,
  handleEscalationDecision,
  handlePlanDecision,
  handlePRDecision,
  handleStatusQuery,
  handleWorkflowControl,
  speakPlanDetails,
  speakPRDetails,
  speakWorkflowDetails,
} from "./voice/handlers";
import { classifyCarPlayIntent, getHelpText } from "./voice/intent";
import { speakGreeting } from "./voice/speech";

export type CarPlayState =
  | "disconnected"
  | "connected"
  | "listening"
  | "processing"
  | "speaking"
  | "offline";

export type CarPlayMode = "simple" | "orchestrator";

type CarPlayControllerConfig = {
  /** tRPC client for API calls */
  trpc?: unknown;
  /** Mode: simple (basic voice) or orchestrator (full workflow control) */
  mode?: CarPlayMode;
  /** Callback when state changes */
  onStateChange?: (state: CarPlayState) => void;
  /** Legacy: Direct voice input handler (used in simple mode) */
  onVoiceInput?: (transcript: string) => Promise<string>;
  /** Legacy: TTS handler */
  speakText?: (text: string) => Promise<void>;
  /** Network status checker */
  isOnline?: () => boolean;
  /** Cookie accessor for authenticated requests */
  getCookie?: () => string | null;
  /** Base URL for voice streaming */
  baseUrl?: string | null;
};

class CarPlayController {
  private state: CarPlayState = "disconnected";
  private mode: CarPlayMode = "orchestrator";
  // Tracks last selected dashboard tab index (0=status, 1=decisions, 2=prs, 3=voice)
  private currentTab = 0;
  private config: CarPlayControllerConfig = {};
  private readonly voiceTemplate = createVoiceTemplate();
  private currentResponse = "";
  private streamBuffer = "";
  private lastUpdateTime = 0;
  private pendingEscalationId: string | null = null;
  private pendingPRId: string | null = null;
  private pendingPlanId: string | null = null;
  private pendingWorkflowId: string | null = null;
  private dashboardCallbacks: DashboardCallbacks | null = null;
  private readonly UPDATE_INTERVAL_MS = 3000;

  initialize(config: CarPlayControllerConfig): void {
    this.config = config;
    this.mode = config.mode ?? "orchestrator";

    // Set up tRPC client for API calls
    if (config.trpc) {
      setTrpcClient(config.trpc as Parameters<typeof setTrpcClient>[0]);
    }

    // Register connection handlers
    CarPlay.registerOnConnect(this.handleConnect);
    CarPlay.registerOnDisconnect(this.handleDisconnect);

    // Initialize audio session with barge-in support
    carPlayAudio.initialize({
      onBargeIn: this.handleBargeIn,
      onInterruption: this.handleAudioInterruption,
    });

    // Subscribe to store updates for template refresh
    this.subscribeToStoreUpdates();
  }

  private subscribeToStoreUpdates(): void {
    // Subscribe to store changes and check for new critical escalations
    let prevEscalationCount = 0;
    useCarPlayStore.subscribe((state) => {
      const escalations = state.escalations;
      if (escalations.length > prevEscalationCount) {
        const newEscalation = escalations.at(-1);
        if (newEscalation && newEscalation.priority === "critical") {
          this.showEscalationAlert(newEscalation);
        }
      }
      prevEscalationCount = escalations.length;
    });
  }

  private readonly handleConnect = (_window: WindowInformation): void => {
    this.setState("connected");

    const isOnline = this.config.isOnline?.() ?? true;

    if (!isOnline) {
      this.showOfflineMode();
      return;
    }

    // Start sync manager
    carPlaySync.start();

    // Show appropriate root template
    if (this.mode === "orchestrator") {
      this.showDashboard();
    } else {
      this.showMainTemplate();
    }

    // Speak greeting
    this.speakGreeting();
  };

  private readonly handleDisconnect = (): void => {
    this.setState("disconnected");
    carPlaySync.stop();
    carPlayAudio.cleanup();
  };

  private setState(newState: CarPlayState): void {
    this.state = newState;
    this.config.onStateChange?.(newState);
    useCarPlayStore
      .getState()
      .setVoiceStatus(
        newState === "listening"
          ? "listening"
          : newState === "processing"
            ? "processing"
            : newState === "speaking"
              ? "speaking"
              : "idle"
      );
  }

  // ============================================================================
  // ORCHESTRATOR MODE - Dashboard and Workflows
  // ============================================================================

  private showDashboard(): void {
    this.dashboardCallbacks = {
      onVoice: () => this.startVoiceInteraction(),
      onWorkflowSelect: (workflow: WorkflowState) =>
        this.showWorkflowDetail(workflow.id),
      onEscalationSelect: (escalation: Escalation) =>
        this.showEscalationDetail(escalation.id),
      onPRSelect: (pr: PullRequest) => this.showPRDetail(pr.id),
      onPlanSelect: (plan: ExecPlan) => this.showPlanApproval(plan.id),
    };

    const template = createDashboardTemplate(this.dashboardCallbacks);
    CarPlay.setRootTemplate(template);
  }

  private doRefreshDashboard(): void {
    if (this.dashboardCallbacks) {
      refreshDashboard(this.dashboardCallbacks);
    }
  }

  private showWorkflowDetail(workflowId: string): void {
    const store = useCarPlayStore.getState();
    const workflow = store.workflows.get(workflowId);
    if (!workflow) {
      return;
    }

    this.pendingWorkflowId = workflowId;

    const template = createWorkflowDetailTemplate(
      workflow,
      () => this.handleWorkflowAction("pause"),
      () => this.handleWorkflowAction("resume"),
      () => this.handleWorkflowAction("cancel"),
      () => CarPlay.popTemplate()
    );
    CarPlay.pushTemplate(template);

    // Speak workflow details
    speakWorkflowDetails(workflowId).then((result) => {
      if (result.success) {
        this.speak(result.text);
      }
    });
  }

  private showEscalationDetail(escalationId: string): void {
    const store = useCarPlayStore.getState();
    const escalation = store.escalations.find((e) => e.id === escalationId);
    if (!escalation) {
      return;
    }

    this.pendingEscalationId = escalationId;

    const template = createEscalationDetailTemplate(
      escalation,
      () => this.handleEscalationAction("approve"),
      () => this.handleEscalationAction("reject"),
      () => this.handleEscalationAction("defer")
    );
    CarPlay.pushTemplate(template);
  }

  private showPRDetail(prId: string): void {
    const store = useCarPlayStore.getState();
    const pr = store.pullRequests.find((p) => p.id === prId);
    if (!pr) {
      return;
    }

    this.pendingPRId = prId;

    const template = createPRDetailTemplate(
      pr,
      () => this.handlePRAction("approve"),
      () => this.handlePRAction("changes"),
      () => this.handlePRAction("defer")
    );
    CarPlay.pushTemplate(template);

    // Speak PR details
    speakPRDetails(prId).then((result) => {
      if (result.success) {
        this.speak(result.text);
      }
    });
  }

  private showPlanApproval(planId: string): void {
    const store = useCarPlayStore.getState();
    const plan = store.pendingPlans.find((p) => p.id === planId);
    if (!plan) {
      return;
    }

    this.pendingPlanId = planId;

    const template = createPlanApprovalTemplate(
      plan,
      () => this.handlePlanAction("approve"),
      () => this.handlePlanAction("reject"),
      () => this.handlePlanAction("modify")
    );
    CarPlay.pushTemplate(template);

    // Speak plan details
    speakPlanDetails(planId).then((result) => {
      if (result.success) {
        this.speak(result.text);
      }
    });
  }

  private showEscalationAlert(escalation: Escalation): void {
    playNotificationCue();

    const alert = createEscalationAlert(
      escalation,
      () => {
        this.pendingEscalationId = escalation.id;
        this.handleEscalationAction("approve");
      },
      () => {
        this.pendingEscalationId = escalation.id;
        this.handleEscalationAction("reject");
      },
      () => {
        this.pendingEscalationId = escalation.id;
        this.handleEscalationAction("defer");
      }
    );
    CarPlay.presentTemplate(alert);
  }

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  private async handleWorkflowAction(
    action: "pause" | "resume" | "cancel"
  ): Promise<void> {
    if (!this.pendingWorkflowId) {
      return;
    }

    const result = await handleWorkflowControl(this.pendingWorkflowId, action);
    playConfirmationCue();
    await this.speak(result.text);

    if (result.success) {
      CarPlay.popTemplate();
      this.doRefreshDashboard();
    }

    this.pendingWorkflowId = null;
  }

  private async handleEscalationAction(
    action: "approve" | "reject" | "defer"
  ): Promise<void> {
    if (!this.pendingEscalationId) {
      return;
    }

    const result = await handleEscalationDecision(
      this.pendingEscalationId,
      action
    );
    playConfirmationCue();
    await this.speak(result.text);

    if (result.success) {
      CarPlay.popTemplate();
      this.doRefreshDashboard();
    }

    this.pendingEscalationId = null;
  }

  private async handlePRAction(
    action: "approve" | "defer" | "changes"
  ): Promise<void> {
    if (!this.pendingPRId) {
      return;
    }

    const result = await handlePRDecision(this.pendingPRId, action);
    playConfirmationCue();
    await this.speak(result.text);

    if (result.success) {
      CarPlay.popTemplate();
      this.doRefreshDashboard();
    }

    this.pendingPRId = null;
  }

  private async handlePlanAction(
    action: "approve" | "reject" | "modify"
  ): Promise<void> {
    if (!this.pendingPlanId) {
      return;
    }

    const result = await handlePlanDecision(this.pendingPlanId, action);
    playConfirmationCue();
    await this.speak(result.text);

    if (result.success) {
      CarPlay.popTemplate();
      this.doRefreshDashboard();
    }

    this.pendingPlanId = null;
  }

  // ============================================================================
  // VOICE INTERACTION
  // ============================================================================

  startVoiceInteraction = async (): Promise<void> => {
    this.setState("listening");
    playListeningCue();

    // Show voice control template
    CarPlay.presentTemplate(this.voiceTemplate);
    this.voiceTemplate.activateVoiceControlState("listening");

    // Start audio session
    await carPlayAudio.startListening();
  };

  processVoiceInput = async (transcript: string): Promise<void> => {
    if (!transcript.trim()) {
      this.voiceTemplate.activateVoiceControlState("error");
      playErrorCue();
      return;
    }

    this.setState("processing");
    this.voiceTemplate.activateVoiceControlState("processing");
    await carPlayAudio.stopListening();

    try {
      if (this.mode === "orchestrator") {
        await this.processOrchestratorIntent(transcript);
      } else {
        await this.processSimpleIntent(transcript);
      }
    } catch (_error) {
      playErrorCue();
      this.showError("Failed to process your request. Please try again.");
    }
  };

  private async processOrchestratorIntent(transcript: string): Promise<void> {
    const { intent, confidence } = await classifyCarPlayIntent(transcript);

    switch (intent.type) {
      case "status_query": {
        const result = await handleStatusQuery(intent.workflowId);
        await this.showResponse(result.text);
        break;
      }

      case "decision_query": {
        const result = await handleDecisionQuery();
        await this.showResponse(result.text);
        break;
      }

      case "escalation_action": {
        // Map 'skip' to 'defer'
        const action = intent.action === "skip" ? "defer" : intent.action;
        if (this.pendingEscalationId) {
          await this.handleEscalationAction(action);
        } else {
          // Get next decision and apply action
          const queue = useCarPlayStore.getState().getDecisionQueue();
          const first = queue[0];
          if (first && "question" in first) {
            this.pendingEscalationId = first.id;
            await this.handleEscalationAction(action);
          } else {
            await this.showResponse(`No pending escalations to ${action}.`);
          }
        }
        break;
      }

      case "pr_action": {
        if (this.pendingPRId) {
          await this.handlePRAction(intent.action);
        } else {
          const prs = useCarPlayStore.getState().pullRequests;
          const first = prs[0];
          if (first) {
            this.pendingPRId = first.id;
            await this.handlePRAction(intent.action);
          } else {
            await this.showResponse("No pending pull requests.");
          }
        }
        break;
      }

      case "plan_action": {
        if (this.pendingPlanId) {
          await this.handlePlanAction(intent.action);
        } else {
          const plans = useCarPlayStore.getState().pendingPlans;
          const first = plans[0];
          if (first) {
            this.pendingPlanId = first.id;
            await this.handlePlanAction(intent.action);
          } else {
            await this.showResponse("No pending plans.");
          }
        }
        break;
      }

      case "workflow_control": {
        const workflowId =
          intent.workflowId ??
          this.pendingWorkflowId ??
          useCarPlayStore.getState().activeWorkflowId;
        if (workflowId) {
          this.pendingWorkflowId = workflowId;
          await this.handleWorkflowAction(intent.action);
        } else {
          await this.showResponse(
            `I don't have an active workflow to ${intent.action}.`
          );
        }
        break;
      }

      case "navigation":
        await this.handleNavigation(intent.target);
        break;

      case "help":
        await this.showResponse(getHelpText());
        break;

      case "new_task":
        // For now, acknowledge and suggest using the app
        await this.showResponse(
          `I heard: "${intent.requirement}". Creating new tasks via voice is coming soon. Please use the app for now.`
        );
        break;
      default:
        // Fall back to simple mode for conversational
        await this.processSimpleIntent(transcript);
        break;
    }
  }

  private async handleNavigation(target: string): Promise<void> {
    CarPlay.dismissTemplate(); // Dismiss voice template

    switch (target) {
      case "status":
        this.currentTab = 0;
        this.doRefreshDashboard();
        await this.speak("Showing workflow status.");
        break;
      case "decisions":
        this.currentTab = 1;
        this.doRefreshDashboard();
        await this.speak("Showing decision queue.");
        break;
      case "prs":
        this.currentTab = 2;
        this.doRefreshDashboard();
        await this.speak("Showing pull requests.");
        break;
      case "voice":
        this.startVoiceInteraction();
        break;
      case "back":
        CarPlay.popTemplate();
        break;
      case "home":
        CarPlay.popToRootTemplate();
        break;
    }

    this.setState("connected");
  }

  private async processSimpleIntent(transcript: string): Promise<void> {
    // Use legacy callback if available
    if (this.config.onVoiceInput) {
      const response = await this.config.onVoiceInput(transcript);
      if (response) {
        this.currentResponse = response;
        await this.showResponse(response);
      }
    } else {
      await this.showResponse(
        "I'm not sure how to help with that. Try asking about workflow status or pending decisions."
      );
    }
  }

  // ============================================================================
  // TTS AND RESPONSE DISPLAY
  // ============================================================================

  private async speak(text: string): Promise<void> {
    if (!text.trim()) {
      return;
    }

    this.setState("speaking");
    await carPlayAudio.startSpeaking();

    if (this.config.speakText) {
      await this.config.speakText(text);
    }

    await carPlayAudio.stopSpeaking();
    this.setState("connected");
  }

  private async speakGreeting(): Promise<void> {
    const store = useCarPlayStore.getState();
    const workflowCount = store.getRunningWorkflows().length;
    const decisionCount = store.getDecisionCount();

    const greeting = speakGreeting(workflowCount, decisionCount);
    await this.speak(greeting);
  }

  private readonly showResponse = async (response: string): Promise<void> => {
    // Dismiss voice template
    CarPlay.dismissTemplate();

    this.currentResponse = response;

    // Start speaking
    await this.speak(response);

    // Show information template with response
    const template = createResponseTemplate(
      response,
      () => this.repeatResponse(),
      () => this.startVoiceInteraction()
    );
    CarPlay.pushTemplate(template);

    this.setState("connected");
  };

  private readonly repeatResponse = async (): Promise<void> => {
    if (this.currentResponse) {
      await this.speak(this.currentResponse);
    }
  };

  handleStreamChunk = (chunk: string): void => {
    this.streamBuffer += chunk;

    const now = Date.now();
    const hasEndPunctuation = /[.!?]\s*$/.test(this.streamBuffer);
    const shouldUpdate =
      hasEndPunctuation || now - this.lastUpdateTime > this.UPDATE_INTERVAL_MS;

    if (shouldUpdate && this.streamBuffer.length > 0) {
      this.lastUpdateTime = now;
      this.config.speakText?.(this.streamBuffer);
      this.streamBuffer = "";
    }
  };

  // ============================================================================
  // SIMPLE MODE TEMPLATES
  // ============================================================================

  private showMainTemplate(): void {
    const template = createMainTemplate(
      this.startVoiceInteraction,
      this.showHistory,
      this.showReminders,
      this.showNotes
    );
    CarPlay.setRootTemplate(template);
  }

  private showOfflineMode(): void {
    this.setState("offline");
    useCarPlayStore.getState().setConnectionStatus("offline");
    const template = createOfflineTemplate();
    CarPlay.setRootTemplate(template);
  }

  private readonly showHistory = async (): Promise<void> => {
    // History would come from store or API
    const template = createHistoryTemplate([], (_id) => {});
    CarPlay.pushTemplate(template);
  };

  private readonly showReminders = async (): Promise<void> => {
    const template = createRemindersTemplate([], (_id) => {});
    CarPlay.pushTemplate(template);
  };

  private readonly showNotes = async (): Promise<void> => {
    const template = createNotesTemplate([], (_id) => {});
    CarPlay.pushTemplate(template);
  };

  // ============================================================================
  // ERROR AND INTERRUPTION HANDLING
  // ============================================================================

  private showError(message: string): void {
    CarPlay.dismissTemplate();
    playErrorCue();
    const alert = createErrorAlert(
      message,
      () => this.startVoiceInteraction(),
      () => {
        if (this.mode === "orchestrator") {
          this.showDashboard();
        } else {
          this.showMainTemplate();
        }
      }
    );
    CarPlay.presentTemplate(alert);
  }

  private readonly handleBargeIn = (): void => {
    carPlayAudio.stopSpeaking();
    this.startVoiceInteraction();
  };

  private readonly handleAudioInterruption = (began: boolean): void => {
    if (began) {
    } else {
    }
  };

  // ============================================================================
  // NETWORK AND LIFECYCLE
  // ============================================================================

  handleNetworkChange(isOnline: boolean): void {
    if (!isOnline && this.state !== "disconnected") {
      carPlaySync.stop();
      this.showOfflineMode();
    } else if (isOnline && this.state === "offline") {
      carPlaySync.start();
      useCarPlayStore.getState().setConnectionStatus("connected");
      if (this.mode === "orchestrator") {
        this.showDashboard();
      } else {
        this.showMainTemplate();
      }
      this.setState("connected");
    }
  }

  cleanup(): void {
    CarPlay.unregisterOnConnect(this.handleConnect);
    CarPlay.unregisterOnDisconnect(this.handleDisconnect);
    carPlaySync.stop();
    carPlayAudio.cleanup();
    useCarPlayStore.getState().reset();
    this.setState("disconnected");
  }

  getState(): CarPlayState {
    return this.state;
  }

  getMode(): CarPlayMode {
    return this.mode;
  }
}

export const carPlayController = new CarPlayController();
