import { asCapabilityId, type CapabilityDescriptor } from "@alfred/type";

/**
 * ALFRED Capability Registry
 *
 * Single source of truth for what ALFRED can do. Every capability is
 * reachable via UI and/or tools. Capabilities marked uiOnly require
 * human interaction and are not exposed as agent tools.
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 2
 */

export const capabilities: readonly CapabilityDescriptor[] = [
  {
    id: asCapabilityId("chat.send"),
    title: "Send chat message",
    summary: "Send a message to the assistant or orchestrator backend.",
    category: "chat",
    risk: "low",
    requiresAuth: true,
    webWindowType: "chat",
    tags: ["chat", "stream"],
  },
  {
    id: asCapabilityId("voice.call"),
    title: "Start voice call",
    summary: "Start a voice session with streaming transcription and replies.",
    category: "voice",
    risk: "medium",
    requiresAuth: true,
    webWindowType: "settings",
    tags: ["voice"],
  },
  {
    id: asCapabilityId("workflow.run"),
    title: "Run workflow",
    summary: "Start and stream a workflow run with phase-by-phase events.",
    category: "workflow",
    risk: "medium",
    requiresAuth: true,
    webWindowType: "workflow",
    tags: ["workflow", "stream"],
  },
  {
    id: asCapabilityId("note.create"),
    title: "Create note",
    summary: "Create a note and persist it for later retrieval.",
    category: "note",
    risk: "low",
    requiresAuth: true,
    webWindowType: "notes",
    tags: ["note"],
  },
  {
    id: asCapabilityId("reminder.create"),
    title: "Create reminder",
    summary: "Create a reminder with an optional due date.",
    category: "reminder",
    risk: "low",
    requiresAuth: true,
    webWindowType: "reminders",
    tags: ["reminder"],
  },
  {
    id: asCapabilityId("agentfs.export"),
    title: "Export AgentFS archive",
    summary: "Export an AgentFS run workspace to CAS for download and restore.",
    category: "agentfs",
    risk: "medium",
    requiresAuth: true,
    requiresElevation: true,
    webWindowType: "agentfs",
    tags: ["agentfs", "archive"],
  },
  {
    id: asCapabilityId("deploy.preview"),
    title: "Deploy preview",
    summary: "Deploy a preview build for a target branch or revision.",
    category: "deploy",
    risk: "high",
    requiresAuth: true,
    requiresElevation: true,
    webWindowType: "admin",
    tags: ["deploy"],
  },
  // Additional capabilities for full domain coverage
  {
    id: asCapabilityId("knowledge.query"),
    title: "Query knowledge graph",
    summary: "Search the knowledge graph for facts, relations, and insights.",
    category: "knowledge",
    risk: "low",
    requiresAuth: true,
    tags: ["knowledge", "graph"],
  },
  {
    id: asCapabilityId("rag.search"),
    title: "Search RAG corpus",
    summary: "Semantic search across ingested documents and code.",
    category: "knowledge",
    risk: "low",
    requiresAuth: true,
    tags: ["rag", "search"],
  },
  {
    id: asCapabilityId("code.edit"),
    title: "Edit code",
    summary: "Create, modify, or refactor code files.",
    category: "code",
    risk: "medium",
    requiresAuth: true,
    tags: ["code", "edit"],
  },
  {
    id: asCapabilityId("git.operation"),
    title: "Git operations",
    summary: "Execute git commands for version control.",
    category: "git",
    risk: "medium",
    requiresAuth: true,
    tags: ["git", "vcs"],
  },
  {
    id: asCapabilityId("docker.manage"),
    title: "Manage Docker containers",
    summary: "Start, stop, and inspect Docker containers.",
    category: "infrastructure",
    risk: "high",
    requiresAuth: true,
    requiresElevation: true,
    tags: ["docker", "infrastructure"],
  },
  // UI-only capabilities (human admin actions, not agent tools)
  {
    id: asCapabilityId("settings.configure"),
    title: "Configure settings",
    summary: "Manage ALFRED configuration and integrations.",
    category: "system",
    risk: "high",
    requiresAuth: true,
    requiresElevation: true,
    uiOnly: true,
    webWindowType: "settings",
    tags: ["settings", "admin"],
  },
  {
    id: asCapabilityId("policy.manage"),
    title: "Manage policies",
    summary: "Configure security policies and access controls.",
    category: "system",
    risk: "high",
    requiresAuth: true,
    requiresElevation: true,
    uiOnly: true,
    webWindowType: "policy",
    tags: ["policy", "security", "admin"],
  },
  {
    id: asCapabilityId("metrics.view"),
    title: "View metrics",
    summary: "Access system metrics and observability dashboards.",
    category: "system",
    risk: "low",
    requiresAuth: true,
    uiOnly: true,
    webWindowType: "metrics",
    tags: ["metrics", "observability"],
  },
];

/**
 * Get capabilities by category.
 */
export function getCapabilitiesByCategory(
  category: string
): CapabilityDescriptor[] {
  return capabilities.filter((c) => c.category === category);
}

/**
 * Get capabilities with tool coverage (excluding uiOnly).
 */
export function getToolCapabilities(): CapabilityDescriptor[] {
  return capabilities.filter((c) => !c.uiOnly);
}

/**
 * Get UI-only capabilities.
 */
export function getUiOnlyCapabilities(): CapabilityDescriptor[] {
  return capabilities.filter((c) => c.uiOnly);
}
