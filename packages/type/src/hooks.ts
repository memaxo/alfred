/**
 * ALFRED Hooks System Type Definitions
 *
 * Inspired by Cursor Agent Hooks, scaled for ALFRED's cognitive architecture,
 * hypergraph memory, self-supervision, and voice-first interaction.
 *
 * @see https://cursor.com/docs/agent/hooks
 * @see docs/execplans/alfred-hooks-system.md
 */

import type { LanguageModel } from "ai";

// -----------------------------------------------------------------------------
// Core Types
// -----------------------------------------------------------------------------

/** Hook event categories */
export type HookCategory =
  | "session"
  | "workflow"
  | "cognitive"
  | "agent"
  | "memory"
  | "learn"
  | "voice"
  | "ui"
  | "policy";

/** Cognitive states from @alfred/cognitive */
export type CognitiveState =
  | "idle"
  | "capturing"
  | "thinking"
  | "deciding"
  | "executing"
  | "reflecting";

/** Autonomy levels */
export type AutonomyLevel = "read" | "low" | "medium" | "high" | "full";

/** Hook decision outcomes */
export type HookDecision = "allow" | "deny" | "ask";

/** Hook fail modes */
export type HookFailMode = "open" | "closed";

/** Feedback types for learning */
export type HookFeedback = "positive" | "negative";

// -----------------------------------------------------------------------------
// Lifecycle Hook Events
// -----------------------------------------------------------------------------

export interface SessionStartEvent {
  readonly type: "session:start";
  readonly sessionId: string;
  readonly isBackgroundAgent: boolean;
  readonly composerMode?: "agent" | "ask" | "edit";
}

export interface SessionEndEvent {
  readonly type: "session:end";
  readonly sessionId: string;
  readonly reason:
    | "completed"
    | "aborted"
    | "error"
    | "window_close"
    | "user_close";
  readonly durationMs: number;
  readonly errorMessage?: string;
}

export interface WorkflowStartEvent {
  readonly type: "workflow:start";
  readonly workflowId: string;
  readonly projectId?: string;
  readonly taskSummary: string;
}

export interface WorkflowSuspendEvent {
  readonly type: "workflow:suspend";
  readonly workflowId: string;
  readonly reason: "biometric_required" | "scope_required" | "user_pause";
}

export interface WorkflowResumeEvent {
  readonly type: "workflow:resume";
  readonly workflowId: string;
  readonly bioTicketValid: boolean;
}

export interface WorkflowCompleteEvent {
  readonly type: "workflow:complete";
  readonly workflowId: string;
  readonly status: "completed" | "error" | "aborted";
  readonly durationMs: number;
  readonly stageCount: number;
}

export interface WorkflowErrorEvent {
  readonly type: "workflow:error";
  readonly workflowId: string;
  readonly error: string;
  readonly stage?: string;
  readonly recoverable: boolean;
}

// -----------------------------------------------------------------------------
// Workflow Pipeline Hook Events (Stages/Review/Learn/Budget/Context)
// -----------------------------------------------------------------------------

export interface WorkflowStageEnterEvent {
  readonly type: "workflow:stage:enter";
  readonly workflowId: string;
  readonly stage: string;
}

export interface WorkflowStageExitEvent {
  readonly type: "workflow:stage:exit";
  readonly workflowId: string;
  readonly stage: string;
  readonly durationMs: number;
}

export interface WorkflowStageErrorEvent {
  readonly type: "workflow:stage:error";
  readonly workflowId: string;
  readonly stage: string;
  readonly error: string;
}

export interface WorkflowStageProgressEvent {
  readonly type: "workflow:stage:progress";
  readonly workflowId: string;
  readonly stage: string;
  readonly message: string;
}

export interface WorkflowReviewCheckEvent {
  readonly type: "workflow:review:check";
  readonly workflowId: string;
  readonly check: {
    readonly name: string;
    readonly passed: boolean;
    readonly message?: string;
  };
}

export interface WorkflowReviewFixStartEvent {
  readonly type: "workflow:review:fix:start";
  readonly workflowId: string;
  readonly attempt: number;
  readonly maxAttempts: number;
}

export interface WorkflowReviewFixCompleteEvent {
  readonly type: "workflow:review:fix:complete";
  readonly workflowId: string;
  readonly attempt: number;
  readonly success: boolean;
}

export interface WorkflowLearnInsightEvent {
  readonly type: "workflow:learn:insight";
  readonly workflowId: string;
  readonly insight: {
    readonly type: "heuristic" | "mistake" | "pattern";
    readonly content: string;
    readonly confidence: number;
  };
}

export interface WorkflowWaveAbortedEvent {
  readonly type: "workflow:wave:aborted";
  readonly workflowId: string;
  readonly waveId: string;
  readonly waveFailRate: number;
  readonly overallFailRate: number;
}

export interface WorkflowContextSetEvent {
  readonly type: "workflow:context:set";
  readonly workflowId: string;
  readonly key: string;
  readonly value: unknown;
}

export interface WorkflowContextCacheHitEvent {
  readonly type: "workflow:context:cache-hit";
  readonly workflowId: string;
  readonly cacheKey: string;
}

export interface WorkflowBudgetWarningEvent {
  readonly type: "workflow:budget:warning";
  readonly workflowId: string;
  readonly costUsd: number;
  readonly budgetUsd: number;
  readonly percentUsed: number;
}

export interface WorkflowBudgetExceededEvent {
  readonly type: "workflow:budget:exceeded";
  readonly workflowId: string;
  readonly costUsd: number;
  readonly budgetUsd: number;
}

export type WorkflowPipelineHookEvent =
  | WorkflowStageEnterEvent
  | WorkflowStageExitEvent
  | WorkflowStageErrorEvent
  | WorkflowStageProgressEvent
  | WorkflowReviewCheckEvent
  | WorkflowReviewFixStartEvent
  | WorkflowReviewFixCompleteEvent
  | WorkflowLearnInsightEvent
  | WorkflowWaveAbortedEvent
  | WorkflowContextSetEvent
  | WorkflowContextCacheHitEvent
  | WorkflowBudgetWarningEvent
  | WorkflowBudgetExceededEvent;

export type LifecycleHookEvent =
  | SessionStartEvent
  | SessionEndEvent
  | WorkflowStartEvent
  | WorkflowSuspendEvent
  | WorkflowResumeEvent
  | WorkflowCompleteEvent
  | WorkflowErrorEvent;

// -----------------------------------------------------------------------------
// Cognitive Hook Events
// -----------------------------------------------------------------------------

export interface CognitiveTransitionEvent {
  readonly type: "cognitive:transition";
  readonly fromState: CognitiveState;
  readonly toState: CognitiveState;
  readonly trigger: string;
}

export interface CognitiveInputEvent {
  readonly type: "cognitive:input";
  readonly input: string;
  readonly intent?: string;
}

export interface CognitiveThinkingEvent {
  readonly type: "cognitive:thinking";
  readonly context: string;
}

export interface CognitiveDecidingEvent {
  readonly type: "cognitive:deciding";
  readonly action: {
    readonly type: string;
    readonly risk: "low" | "medium" | "high";
    readonly description: string;
  };
}

export interface CognitiveActingEvent {
  readonly type: "cognitive:acting";
  readonly action: string;
  readonly toolName?: string;
}

export interface CognitiveLearningEvent {
  readonly type: "cognitive:learning";
  readonly outcome: "success" | "failure";
  readonly context: string;
}

export interface CognitiveAutonomyChangeEvent {
  readonly type: "cognitive:autonomy:change";
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly reason: string;
}

export interface CognitivePhysiologyAlertEvent {
  readonly type: "cognitive:physiology:alert";
  readonly metric: "energy" | "boredom" | "frustration";
  readonly value: number;
  readonly threshold: number;
}

export type CognitiveHookEvent =
  | CognitiveTransitionEvent
  | CognitiveInputEvent
  | CognitiveThinkingEvent
  | CognitiveDecidingEvent
  | CognitiveActingEvent
  | CognitiveLearningEvent
  | CognitiveAutonomyChangeEvent
  | CognitivePhysiologyAlertEvent;

// -----------------------------------------------------------------------------
// Agent Hook Events
// -----------------------------------------------------------------------------

export interface AgentSpawnEvent {
  readonly type: "agent:spawn";
  readonly agentId: string;
  readonly agentType: "generalPurpose" | "explore" | "shell" | string;
  readonly prompt: string;
  readonly model: string;
}

export interface AgentToolBeforeEvent {
  readonly type: "agent:tool:before";
  readonly toolName: string;
  readonly toolInput: unknown;
  readonly toolUseId: string;
  readonly cwd?: string;
}

export interface AgentToolAfterEvent {
  readonly type: "agent:tool:after";
  readonly toolName: string;
  readonly toolInput: unknown;
  readonly toolOutput: unknown;
  readonly toolUseId: string;
  readonly durationMs: number;
}

export interface AgentToolErrorEvent {
  readonly type: "agent:tool:error";
  readonly toolName: string;
  readonly toolInput: unknown;
  readonly toolUseId: string;
  readonly error: string;
  readonly failureType: "error" | "timeout" | "permission_denied";
  readonly durationMs: number;
}

export interface AgentEscalateEvent {
  readonly type: "agent:escalate";
  readonly reason: string;
  readonly details: string;
  readonly suggestions: readonly string[];
  readonly severity: "low" | "medium" | "high" | "critical";
}

export interface AgentStuckEvent {
  readonly type: "agent:stuck";
  readonly reason: string;
  readonly loopCount: number;
  readonly entropyScore: number;
}

export interface AgentShellBeforeEvent {
  readonly type: "agent:shell:before";
  readonly command: string;
  readonly cwd: string;
  readonly timeout?: number;
}

export interface AgentShellAfterEvent {
  readonly type: "agent:shell:after";
  readonly command: string;
  readonly output: string;
  readonly exitCode: number;
  readonly durationMs: number;
}

export interface AgentFileBeforeEvent {
  readonly type: "agent:file:before";
  readonly filePath: string;
  readonly operation: "read" | "write" | "delete";
  readonly content?: string;
}

export interface AgentFileAfterEvent {
  readonly type: "agent:file:after";
  readonly filePath: string;
  readonly operation: "read" | "write" | "delete";
  readonly edits?: readonly {
    readonly oldString: string;
    readonly newString: string;
  }[];
}

export interface AgentMcpBeforeEvent {
  readonly type: "agent:mcp:before";
  readonly toolName: string;
  readonly toolInput: unknown;
  readonly serverUrl?: string;
  readonly serverCommand?: string;
}

export interface AgentMcpAfterEvent {
  readonly type: "agent:mcp:after";
  readonly toolName: string;
  readonly toolInput: unknown;
  readonly resultJson: string;
  readonly durationMs: number;
}

export type AgentHookEvent =
  | AgentSpawnEvent
  | AgentToolBeforeEvent
  | AgentToolAfterEvent
  | AgentToolErrorEvent
  | AgentEscalateEvent
  | AgentStuckEvent
  | AgentShellBeforeEvent
  | AgentShellAfterEvent
  | AgentFileBeforeEvent
  | AgentFileAfterEvent
  | AgentMcpBeforeEvent
  | AgentMcpAfterEvent;

// -----------------------------------------------------------------------------
// Memory Hook Events
// -----------------------------------------------------------------------------

export interface MemorySearchEvent {
  readonly type: "memory:search";
  readonly query: string;
  readonly limit: number;
  readonly filters?: Record<string, unknown>;
}

export interface MemoryRetrieveEvent {
  readonly type: "memory:retrieve";
  readonly memoryId: string;
  readonly expandNeighbors: boolean;
  readonly depth?: number;
}

export interface MemoryCreateEvent {
  readonly type: "memory:create";
  readonly content: string;
  readonly kind: "fact" | "relation" | "insight" | "heuristic";
  readonly confidence: number;
  readonly metadata?: Record<string, unknown>;
}

export interface MemoryUpdateEvent {
  readonly type: "memory:update";
  readonly memoryId: string;
  readonly changes: {
    readonly confidence?: number;
    readonly properties?: Record<string, unknown>;
    readonly label?: string;
  };
}

export interface MemoryDecayEvent {
  readonly type: "memory:decay";
  readonly memoryId: string;
  readonly fromConfidence: number;
  readonly toConfidence: number;
  readonly reason: "time" | "contradiction" | "manual";
}

export interface MemoryForgetEvent {
  readonly type: "memory:forget";
  readonly memoryId: string;
  readonly deleteType: "soft" | "hard";
  readonly reason?: string;
}

export interface MemoryTraverseEvent {
  readonly type: "memory:traverse";
  readonly startNodeId: string;
  readonly traversalType: "bfs" | "dfs" | "semantic";
  readonly maxDepth: number;
  readonly query?: string;
  readonly direction?: "in" | "out" | "both";
  readonly kind?: string;
  readonly limit?: number;
}

export interface MemoryConsolidateEvent {
  readonly type: "memory:consolidate";
  readonly nodeCount: number;
  readonly heuristicsExtracted: number;
}

export type MemoryHookEvent =
  | MemorySearchEvent
  | MemoryRetrieveEvent
  | MemoryCreateEvent
  | MemoryUpdateEvent
  | MemoryDecayEvent
  | MemoryForgetEvent
  | MemoryTraverseEvent
  | MemoryConsolidateEvent;

// -----------------------------------------------------------------------------
// Learning Hook Events
// -----------------------------------------------------------------------------

export interface LearnPatternDetectedEvent {
  readonly type: "learn:pattern:detected";
  readonly pattern: {
    readonly type: string;
    readonly description: string;
    readonly confidence: number;
    readonly examples: readonly string[];
  };
}

export interface LearnHeuristicProposedEvent {
  readonly type: "learn:heuristic:proposed";
  readonly heuristic: {
    readonly condition: string;
    readonly action: string;
    readonly confidence: number;
    readonly source: "dreaming" | "feedback" | "observation";
  };
}

export interface LearnConventionLearnedEvent {
  readonly type: "learn:convention:learned";
  readonly convention: {
    readonly domain: string;
    readonly rule: string;
    readonly examples: readonly string[];
  };
}

export interface LearnAntipatternFlaggedEvent {
  readonly type: "learn:antipattern:flagged";
  readonly antipattern: {
    readonly description: string;
    readonly failureCount: number;
    readonly lastOccurrence: string;
  };
}

export interface LearnFeedbackPositiveEvent {
  readonly type: "learn:feedback:positive";
  readonly context: string;
  readonly action: string;
  readonly reinforcement: number;
}

export interface LearnFeedbackNegativeEvent {
  readonly type: "learn:feedback:negative";
  readonly context: string;
  readonly action: string;
  readonly reason?: string;
}

export type LearnHookEvent =
  | LearnPatternDetectedEvent
  | LearnHeuristicProposedEvent
  | LearnConventionLearnedEvent
  | LearnAntipatternFlaggedEvent
  | LearnFeedbackPositiveEvent
  | LearnFeedbackNegativeEvent;

// -----------------------------------------------------------------------------
// Voice Hook Events
// -----------------------------------------------------------------------------

export interface VoiceSessionStartEvent {
  readonly type: "voice:session:start";
  readonly voiceSessionId: string;
  readonly device?: string;
}

export interface VoiceSessionEndEvent {
  readonly type: "voice:session:end";
  readonly voiceSessionId: string;
  readonly durationMs: number;
  readonly utteranceCount: number;
}

export interface VoiceSttBeforeEvent {
  readonly type: "voice:stt:before";
  readonly audioLengthMs: number;
  readonly sampleRate: number;
}

export interface VoiceSttAfterEvent {
  readonly type: "voice:stt:after";
  readonly transcript: string;
  readonly confidence: number;
  readonly durationMs: number;
}

export interface VoiceTtsBeforeEvent {
  readonly type: "voice:tts:before";
  readonly text: string;
  readonly voice?: string;
  readonly rate?: number;
}

export interface VoiceTtsAfterEvent {
  readonly type: "voice:tts:after";
  readonly text: string;
  readonly audioLengthMs: number;
  readonly durationMs: number;
}

export interface VoiceBargeInEvent {
  readonly type: "voice:bargein";
  readonly interruptedText: string;
  readonly playbackPositionMs: number;
}

export interface VoiceSilenceEvent {
  readonly type: "voice:silence";
  readonly silenceDurationMs: number;
  readonly threshold: number;
}

export type VoiceHookEvent =
  | VoiceSessionStartEvent
  | VoiceSessionEndEvent
  | VoiceSttBeforeEvent
  | VoiceSttAfterEvent
  | VoiceTtsBeforeEvent
  | VoiceTtsAfterEvent
  | VoiceBargeInEvent
  | VoiceSilenceEvent;

// -----------------------------------------------------------------------------
// UI Hook Events
// -----------------------------------------------------------------------------

export interface UiWindowOpenEvent {
  readonly type: "ui:window:open";
  readonly windowId: string;
  readonly windowType: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly size: { readonly width: number; readonly height: number };
}

export interface UiWindowCloseEvent {
  readonly type: "ui:window:close";
  readonly windowId: string;
  readonly windowType: string;
}

export interface UiFocusChangeEvent {
  readonly type: "ui:focus:change";
  readonly fromWindowId?: string;
  readonly toWindowId?: string;
}

export interface UiNotificationShowEvent {
  readonly type: "ui:notification:show";
  readonly notificationId: string;
  readonly title: string;
  readonly priority: "low" | "normal" | "high" | "urgent";
}

export interface UiGenuiRenderEvent {
  readonly type: "ui:genui:render";
  readonly componentName: string;
  readonly schemaValid: boolean;
}

export type UiHookEvent =
  | UiWindowOpenEvent
  | UiWindowCloseEvent
  | UiFocusChangeEvent
  | UiNotificationShowEvent
  | UiGenuiRenderEvent;

// -----------------------------------------------------------------------------
// Policy Hook Events
// -----------------------------------------------------------------------------

export interface PolicyCheckEvent {
  readonly type: "policy:check";
  readonly resource: string;
  readonly action: string;
  readonly context: Record<string, unknown>;
}

export interface PolicyElevateEvent {
  readonly type: "policy:elevate";
  readonly reason: string;
  readonly requiredLevel: AutonomyLevel;
}

export interface PolicyDenyEvent {
  readonly type: "policy:deny";
  readonly resource: string;
  readonly action: string;
  readonly reason: string;
}

export interface PolicyScopeRequestEvent {
  readonly type: "policy:scope:request";
  readonly scope: string;
  readonly toolName: string;
  readonly justification: string;
}

export type PolicyHookEvent =
  | PolicyCheckEvent
  | PolicyElevateEvent
  | PolicyDenyEvent
  | PolicyScopeRequestEvent;

// -----------------------------------------------------------------------------
// Union Types
// -----------------------------------------------------------------------------

/** All possible hook events */
export type HookEvent =
  | LifecycleHookEvent
  | WorkflowPipelineHookEvent
  | CognitiveHookEvent
  | AgentHookEvent
  | MemoryHookEvent
  | LearnHookEvent
  | VoiceHookEvent
  | UiHookEvent
  | PolicyHookEvent;

/** Extract event type string from HookEvent union */
export type HookEventType = HookEvent["type"];

// -----------------------------------------------------------------------------
// Hook Input/Output
// -----------------------------------------------------------------------------

/** Physiology state included in hook context */
export interface Physiology {
  readonly energy: number;
  readonly boredom: number;
  readonly frustration: number;
}

/** Cognitive context included in hook input */
export interface CognitiveContext {
  readonly state: CognitiveState;
  readonly autonomy: number;
  readonly physiology: Physiology;
}

/** User preferences included in hook context */
export interface UserPreferences {
  readonly responseStyle?: string;
  readonly toolPreferences?: Record<string, unknown>;
  readonly domain?: string;
}

/** Project info included in hook context */
export interface ProjectInfo {
  readonly path: string;
  readonly name: string;
  readonly type?: string;
}

/** Input provided to all hooks */
export interface HookInput<T extends HookEvent = HookEvent> {
  readonly hookEvent: T["type"];
  readonly sessionId: string;
  readonly workflowId?: string;
  readonly timestamp: string;
  readonly alfredVersion: string;
  readonly cognitive: CognitiveContext;
  readonly payload: T;
  readonly context?: {
    readonly recentEvents?: readonly HookEvent[];
    readonly preferences?: UserPreferences;
    readonly activeProject?: ProjectInfo;
  };
}

/** Learning hint that hooks can provide */
export interface LearnHint {
  readonly pattern?: string;
  readonly feedback?: HookFeedback;
  readonly weight?: number;
}

/** Output returned by hooks */
export interface HookOutput<T extends HookEvent = HookEvent> {
  /** Decision for gating hooks */
  readonly decision?: HookDecision;
  /** Reason shown to agent when denied */
  readonly reason?: string;
  /** Message shown to user */
  readonly userMessage?: string;
  /** Message injected into agent context */
  readonly agentMessage?: string;
  /** Transformed payload (replaces input) */
  readonly transformed?: T;
  /** Auto-submit as next user message (lifecycle hooks) */
  readonly followupMessage?: string;
  /** Environment variables to inject (session:start) */
  readonly env?: Record<string, string>;
  /** Additional context to inject */
  readonly additionalContext?: string;
  /** Events to emit to workflow stream */
  readonly emit?: readonly unknown[];
  /** Learning hints for self-supervision */
  readonly learn?: LearnHint;

  /** Skip remaining hooks for this event (e.g., exit code semantics for command hooks) */
  readonly skipRemaining?: boolean;
}

// -----------------------------------------------------------------------------
// Hook Configuration
// -----------------------------------------------------------------------------

/** Matcher for filtering when hooks run */
export interface HookMatcher {
  readonly toolName?: string;
  readonly agentType?: string;
  readonly commandPattern?: string;
  readonly stateFrom?: CognitiveState;
  readonly stateTo?: CognitiveState;
  readonly risk?: "low" | "medium" | "high";
  readonly memoryKind?: "fact" | "relation" | "insight" | "heuristic";
}

/** Command-based hook configuration */
export interface CommandHookConfig {
  readonly type?: "command";
  readonly command: string;
  readonly timeout?: number;
  readonly failMode?: HookFailMode;
  readonly matcher?: HookMatcher;
  readonly async?: boolean;
  readonly transform?: boolean;
}

/** Prompt-based hook configuration (LLM evaluation) */
export interface PromptHookConfig {
  readonly type: "prompt";
  readonly prompt: string;
  readonly model?: string;
  readonly timeout?: number;
  readonly matcher?: HookMatcher;
}

/** Hook configuration union */
export type HookConfig = CommandHookConfig | PromptHookConfig;

/** JSON configuration file schema */
export interface HooksJsonConfig {
  readonly version: 1;
  readonly hooks: Partial<Record<HookEventType, readonly HookConfig[]>>;
}

// -----------------------------------------------------------------------------
// Hook Registry
// -----------------------------------------------------------------------------

/** Hook handler function signature */
export type HookHandlerResult<T extends HookEvent = HookEvent> =
  | HookOutput<T>
  | T;

/** Hook handler function signature */
export type HookHandler<T extends HookEvent = HookEvent> = (
  event: T,
  context: HookContext
) => Promise<HookHandlerResult<T>> | HookHandlerResult<T>;

/** Context provided to hook handlers */
export interface HookContext {
  /** Current session identifier */
  readonly sessionId: string;
  /** Current workflow run identifier (when running a pipeline) */
  readonly workflowId?: string;
  /** Current autonomy level (0.0-1.0) */
  readonly autonomy: number;
  /** Current cognitive context */
  readonly cognitive: CognitiveContext;
  /** ALFRED version string */
  readonly alfredVersion: string;
  /** Active project directory */
  readonly projectDir?: string;
  /** Emit additional events to workflow stream */
  readonly emit: (event: unknown) => Promise<void>;
  /** Abort signal for cancellation */
  readonly signal: AbortSignal;
  /** Optional LLM handle for prompt-based hooks (LLM-as-logic-circuit). */
  readonly llm?: {
    readonly model: LanguageModel;
    /** Optional identifier for logging/metrics (LanguageModel may not expose id). */
    readonly modelKey?: string;
  };
  /** Logger */
  readonly log: {
    readonly debug: (msg: string, data?: unknown) => void;
    readonly info: (msg: string, data?: unknown) => void;
    readonly warn: (msg: string, data?: unknown) => void;
    readonly error: (msg: string, data?: unknown) => void;
  };
}

/** Hook registry interface */
export interface HookRegistry {
  /** Register a typed hook handler */
  on<T extends HookEventType>(
    event: T,
    handler: HookHandler<Extract<HookEvent, { type: T }>>
  ): () => void;

  /** Emit a hook event and collect results */
  emit<T extends HookEvent>(
    event: T,
    context: HookContext
  ): Promise<HookOutput<T>>;

  /** Load hooks from JSON configuration */
  loadConfig(config: HooksJsonConfig): void;

  /** Get all registered hook types */
  registeredEvents(): readonly HookEventType[];
}

// -----------------------------------------------------------------------------
// Performance Budgets
// -----------------------------------------------------------------------------

/** Performance budget for hook categories */
export interface HookBudget {
  readonly category: HookCategory;
  readonly budgetMs: number;
  readonly rationale: string;
}

/** Default budgets per category */
export const DEFAULT_HOOK_BUDGETS: readonly HookBudget[] = [
  { category: "cognitive", budgetMs: 10, rationale: "Hot path, <100µs ideal" },
  { category: "voice", budgetMs: 50, rationale: "Real-time audio processing" },
  {
    category: "agent",
    budgetMs: 100,
    rationale: "Can gate but shouldn't block",
  },
  { category: "memory", budgetMs: 100, rationale: "Part of RAG pipeline" },
  { category: "learn", budgetMs: 1000, rationale: "Offline-ok" },
  { category: "workflow", budgetMs: 500, rationale: "Setup/teardown" },
  { category: "session", budgetMs: 500, rationale: "Setup/teardown" },
  { category: "ui", budgetMs: 16, rationale: "60fps frame budget" },
  {
    category: "policy",
    budgetMs: 100,
    rationale: "Security-critical but common",
  },
] as const;

/** Default fail modes per event type prefix */
export const DEFAULT_FAIL_MODES: Partial<Record<string, HookFailMode>> = {
  "session:": "open",
  "workflow:": "open",
  "cognitive:": "open",
  "agent:shell:before": "closed",
  "agent:file:before": "closed",
  "agent:mcp:before": "closed",
  "agent:tool:after": "open",
  "memory:": "open",
  "learn:": "open",
  "voice:": "open",
  "ui:": "open",
  "policy:": "closed",
} as const;
