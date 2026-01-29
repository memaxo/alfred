/**
 * Intent-based tool routing for agent capability parity.
 *
 * Routes user requests to appropriate tool catalogs based on intent classification.
 * Ensures no agent has more than 5 tools at once (AI SDK v6 hygiene).
 *
 * @see .ruler/55-llm-first-classification.md
 */

import type { CapabilityId } from "@alfred/type";
import type { Tool } from "ai";

import { classify, OFFLINE_MODE } from "@alfred/plan/classify";
import { z } from "zod";

import { toolHandoff } from "../../assistant/src/tool/handoff";
import { toolNote } from "../../assistant/src/tool/note";
import { toolRemind } from "../../assistant/src/tool/remind";
import { toolTimer } from "../../assistant/src/tool/timer";
import {
  toolVoiceStatus,
  toolVoiceControl,
} from "../../assistant/src/tool/voice";
import { toolCodex } from "../orchestrator/tool/codex/index";
import { toolDocker } from "../orchestrator/tool/docker";
import { toolDroid } from "../orchestrator/tool/droid";
import { toolGit } from "../orchestrator/tool/git";
import { toolKnowledgeQuery } from "../orchestrator/tool/knowledge";
import { toolOpenCode } from "../orchestrator/tool/opencode";
import { toolRagQuery } from "../orchestrator/tool/rag";
import { getClassificationModel } from "../selector.js";
import { wrapLegacyToolToAISDK } from "../v6.js";

/**
 * Intent categories for routing decisions.
 */
export const INTENT_CATEGORIES = [
  "personal", // Personal assistant tasks (notes, reminders, timers)
  "voice", // Voice session control
  "code_edit", // Code editing tasks
  "code_review", // Code review/analysis
  "deploy", // Deployment operations
  "infrastructure", // Docker, Proxmox, etc.
  "knowledge", // Knowledge graph, RAG queries
  "git", // Git operations
  "workflow", // Complex multi-step workflows
  "handoff", // Escalate to orchestrator
] as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[number];

/**
 * Schema for intent routing classification.
 */
const intentRoutingSchema = z.object({
  category: z.enum(INTENT_CATEGORIES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
});

/**
 * Tool catalog definition - max 5 tools per catalog.
 */
export interface ToolCatalog {
  readonly id: IntentCategory;
  readonly name: string;
  readonly description: string;
  readonly capabilities: CapabilityId[];
  readonly tools: Tool[];
}

// Legacy tool type for internal use before wrapping
interface LegacyTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  // oxlint-disable noExplicitAny: Legacy migration bridge
  execute: (args: any, options?: unknown) => unknown;
}

function wrapTools(legacyTools: LegacyTool[]): Tool[] {
  return legacyTools.map((t) => wrapLegacyToolToAISDK(t));
}

/**
 * Personal assistant catalog - daily productivity tasks.
 * Max 5 tools.
 */
const personalCatalog: ToolCatalog = {
  id: "personal",
  name: "Personal Assistant",
  description: "Personal productivity tools for notes, reminders, and timers",
  capabilities: [
    "note.create" as CapabilityId,
    "reminder.create" as CapabilityId,
  ],
  tools: wrapTools([toolNote, toolRemind, toolTimer]),
};

/**
 * Voice control catalog - voice session management.
 * Max 5 tools.
 */
const voiceCatalog: ToolCatalog = {
  id: "voice",
  name: "Voice Control",
  description: "Voice session and audio control tools",
  capabilities: ["voice.call" as CapabilityId],
  tools: wrapTools([toolVoiceStatus, toolVoiceControl]),
};

/**
 * Code editing catalog - direct code manipulation.
 * Max 5 tools.
 */
const codeEditCatalog: ToolCatalog = {
  id: "code_edit",
  name: "Code Editor",
  description: "Code editing and file manipulation tools",
  capabilities: ["code.edit" as CapabilityId],
  tools: wrapTools([toolCodex, toolOpenCode]),
};

/**
 * Infrastructure catalog - Docker, runtime operations.
 * Max 5 tools.
 */
const infrastructureCatalog: ToolCatalog = {
  id: "infrastructure",
  name: "Infrastructure",
  description: "Docker and infrastructure management tools",
  capabilities: [
    "deploy.preview" as CapabilityId,
    "docker.manage" as CapabilityId,
  ],
  tools: wrapTools([toolDocker]),
};

/**
 * Knowledge catalog - RAG and knowledge graph queries.
 * Max 5 tools.
 */
const knowledgeCatalog: ToolCatalog = {
  id: "knowledge",
  name: "Knowledge",
  description: "Knowledge graph and RAG query tools",
  capabilities: [
    "knowledge.query" as CapabilityId,
    "rag.search" as CapabilityId,
  ],
  tools: wrapTools([toolKnowledgeQuery, toolRagQuery]),
};

/**
 * Git catalog - Version control operations.
 * Max 5 tools.
 */
const gitCatalog: ToolCatalog = {
  id: "git",
  name: "Git",
  description: "Git version control tools",
  capabilities: ["git.operation" as CapabilityId],
  tools: wrapTools([toolGit]),
};

/**
 * Workflow catalog - Complex multi-agent workflows.
 * Max 5 tools (includes handoff).
 */
const workflowCatalog: ToolCatalog = {
  id: "workflow",
  name: "Workflow",
  description: "Multi-step workflow and orchestration tools",
  capabilities: [
    "workflow.run" as CapabilityId,
    "agentfs.export" as CapabilityId,
  ],
  tools: wrapTools([toolHandoff, toolDroid]),
};

/**
 * Code review catalog - code analysis and explanation.
 * Max 5 tools. Shares tools with code_edit but has distinct identity.
 */
const codeReviewCatalog: ToolCatalog = {
  id: "code_review",
  name: "Code Review",
  description: "Code review and analysis tools",
  capabilities: [],
  tools: wrapTools([toolCodex, toolOpenCode]),
};

/**
 * Deploy catalog - deployment operations.
 * Max 5 tools. Shares tools with infrastructure.
 */
const deployCatalog: ToolCatalog = {
  id: "deploy",
  name: "Deploy",
  description: "Deployment and preview tools",
  capabilities: ["deploy.preview" as CapabilityId],
  tools: wrapTools([toolDocker]),
};

/**
 * Handoff catalog - escalation to orchestrator.
 * Max 5 tools. Shares tools with workflow.
 */
const handoffCatalog: ToolCatalog = {
  id: "handoff",
  name: "Handoff",
  description: "Escalation and handoff tools",
  capabilities: ["workflow.run" as CapabilityId],
  tools: wrapTools([toolHandoff, toolDroid]),
};

/**
 * All available tool catalogs.
 */
export const TOOL_CATALOGS: Record<IntentCategory, ToolCatalog> = {
  personal: personalCatalog,
  voice: voiceCatalog,
  code_edit: codeEditCatalog,
  code_review: codeReviewCatalog,
  deploy: deployCatalog,
  infrastructure: infrastructureCatalog,
  knowledge: knowledgeCatalog,
  git: gitCatalog,
  workflow: workflowCatalog,
  handoff: handoffCatalog,
};

/**
 * Get catalog by intent category.
 */
export function getCatalogForIntent(intent: IntentCategory): ToolCatalog {
  return TOOL_CATALOGS[intent] ?? personalCatalog;
}

/**
 * Build classification prompt for intent routing.
 */
function buildRoutingPrompt(message: string, context?: string[]): string {
  const ctx =
    context && context.length > 0
      ? `\nRecent context:\n${context.slice(-3).join("\n")}`
      : "";

  return `Classify the user's intent into exactly one category.

User message: "${message}"${ctx}

Categories:
- personal: Notes, reminders, timers, personal productivity ("remind me to...", "create a note...")
- voice: Voice session control, audio settings ("start voice call", "mute microphone")
- code_edit: Code editing, file creation, refactoring ("fix the bug in...", "add a function to...")
- code_review: Code review, analysis, explanation ("explain this code", "review the PR")
- deploy: Deployment, preview builds ("deploy this branch", "create preview")
- infrastructure: Docker, containers, infrastructure ("start the container", "check docker status")
- knowledge: Knowledge graph queries, RAG search ("find related docs", "what do we know about...")
- git: Git operations ("commit changes", "create a branch", "show git log")
- workflow: Complex multi-step tasks requiring orchestration ("refactor the entire module", "implement full feature")
- handoff: Explicit escalation to orchestrator ("handoff to orchestrator", "need advanced help")

Respond with the category, confidence (0-1), and brief reasoning.`.trim();
}

/**
 * Heuristic fallback for intent classification when offline.
 */
export function classifyIntentHeuristic(message: string): IntentCategory {
  const lower = message.toLowerCase();

  // Handoff triggers (highest priority)
  if (/\b(handoff|orchestrator|escalate|advanced help)\b/i.test(lower)) {
    return "handoff";
  }

  // Personal triggers (check early to avoid misclassification)
  // "remind me to call" should be personal, not voice
  if (/\b(remind me|create a note|set a timer|take a note)\b/i.test(lower)) {
    return "personal";
  }

  // Voice triggers (exclude "call" when it's about phone calls)
  if (
    /\b(voice|microphone|audio|mute|unmute|start call|end call)\b/i.test(lower)
  ) {
    return "voice";
  }

  // Deploy triggers
  if (/\b(deploy|preview|build|release|publish)\b/i.test(lower)) {
    return "deploy";
  }

  // Infrastructure triggers
  if (/\b(docker|container|infrastructure|server|proxmox)\b/i.test(lower)) {
    return "infrastructure";
  }

  // Git triggers
  if (/\b(git|commit|branch|merge|push|pull|rebase)\b/i.test(lower)) {
    return "git";
  }

  // Code review triggers
  if (
    /\b(review|explain|analyze|understand|what does this do)\b/i.test(lower)
  ) {
    return "code_review";
  }

  // Code edit triggers - expanded to catch bug fixes
  if (
    /\b(fix|edit|create|add|implement|refactor|delete|update|change)\b.*\b(file|code|function|class|method|bug|error|issue)\b/i.test(
      lower
    )
  ) {
    return "code_edit";
  }

  // Knowledge triggers
  if (/\b(find|search|lookup|what do we know|related|similar)\b/i.test(lower)) {
    return "knowledge";
  }

  // Workflow triggers (complex tasks)
  if (
    /\b(refactor|implement|create|build).*\b(entire|full|complete|module|system|feature)\b/i.test(
      lower
    )
  ) {
    return "workflow";
  }

  // Personal triggers (general)
  if (/\b(remind|note|timer|remember|schedule)\b/i.test(lower)) {
    return "personal";
  }

  // Default to personal for assistant
  return "personal";
}

/**
 * Route user message to appropriate tool catalog based on intent.
 *
 * Uses LLM-based classification by default for semantic understanding.
 * Falls back to regex heuristics when offline.
 *
 * @param message - User message to classify
 * @param context - Optional recent conversation context
 * @returns The selected tool catalog and classification metadata
 */
export async function routeToolsByIntent(
  message: string,
  context?: string[]
): Promise<{
  catalog: ToolCatalog;
  category: IntentCategory;
  confidence: number;
  source: "llm" | "fallback";
}> {
  // Use heuristic in offline mode
  if (OFFLINE_MODE) {
    const category = classifyIntentHeuristic(message);
    return {
      catalog: getCatalogForIntent(category),
      category,
      confidence: 0.5,
      source: "fallback",
    };
  }

  // Use LLM classification
  const selection = getClassificationModel();

  try {
    const result = await classify(
      intentRoutingSchema,
      buildRoutingPrompt(message, context),
      {
        model: selection.model,
        modelKey: selection.modelKey,
        metricType: "intent",
        fallback: () => ({
          category: classifyIntentHeuristic(message),
          confidence: 0.5,
          reasoning: "Fallback heuristic",
        }),
      }
    );

    const { category } = result.result;

    return {
      catalog: getCatalogForIntent(category),
      category,
      confidence: result.result.confidence,
      source: result.source,
    };
  } catch {
    // Final fallback on error
    const category = classifyIntentHeuristic(message);
    return {
      catalog: getCatalogForIntent(category),
      category,
      confidence: 0.5,
      source: "fallback",
    };
  }
}

/**
 * Get all tools for a specific capability.
 * Returns empty array if capability has no associated tools (uiOnly).
 */
export function getToolsForCapability(capabilityId: CapabilityId): Tool[] {
  for (const catalog of Object.values(TOOL_CATALOGS)) {
    if (catalog.capabilities.includes(capabilityId)) {
      return catalog.tools;
    }
  }
  return [];
}

/**
 * Capabilities that have implicit coverage (not through tool catalogs).
 * These are base transport or system capabilities.
 */
const IMPLICIT_COVERAGE = new Set<string>([
  "chat.send", // Base chat transport - not a tool
]);

/**
 * Check if a capability has tool coverage.
 */
export function hasToolCoverage(capabilityId: CapabilityId): boolean {
  if (IMPLICIT_COVERAGE.has(capabilityId)) {
    return true;
  }
  return getToolsForCapability(capabilityId).length > 0;
}
