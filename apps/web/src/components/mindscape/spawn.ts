import type { Node } from "@xyflow/react";
import { nanoid } from "nanoid";
import type { ArtifactData } from "@/store/mindscape";

export const mindscapeSpawnTypes = [
  "chat",
  "note",
  "reminder",
  "timer",
  "bookmark",
  "todo",
  "settings",
  "privacy",
  "profile",
  "integrations",
  "workflowlist",
  "deployment",
  "workflow",
  "concept",
] as const;

export type MindscapeSpawnType = (typeof mindscapeSpawnTypes)[number];

export type MindscapeSearchParams = {
  nodeId?: string;
  spawn?: MindscapeSpawnType;
  open?: string;
};

export const singletonSpawnTypes: MindscapeSpawnType[] = [
  "chat",
  "timer",
  "bookmark",
  "todo",
  "settings",
  "privacy",
  "profile",
  "integrations",
  "workflowlist",
  "deployment",
];

const spawnLabels: Record<MindscapeSpawnType, string> = {
  chat: "Chat",
  note: "Note",
  reminder: "Reminder",
  timer: "Timer",
  bookmark: "Bookmark",
  todo: "Todo",
  settings: "Settings",
  privacy: "Privacy",
  profile: "Profile",
  integrations: "Integrations",
  workflowlist: "Workflow List",
  deployment: "Deployments",
  workflow: "Workflow",
  concept: "Concept",
};

export function formatSpawnLabel(type: MindscapeSpawnType): string {
  return spawnLabels[type];
}

export function createSpawnNode(
  type: MindscapeSpawnType,
  nodeCount: number
): Node<ArtifactData> | null {
  const id = `${type}-${nanoid(6)}`;
  const position = getSpawnPosition(nodeCount);

  switch (type) {
    case "chat":
      return {
        id,
        type: "chat",
        position,
        data: { label: "Neural Stream", messages: [] },
      };
    case "note":
      return {
        id,
        type: "note",
        position,
        data: {
          label: "New Note",
          title: "",
          content: "",
          noteId: undefined,
          mode: "edit",
        },
      };
    case "reminder":
      return {
        id,
        type: "reminder",
        position,
        data: {
          label: "Reminder",
          title: "",
          due: undefined,
          reminderId: undefined,
          description: "",
          status: "scheduled",
          mode: "edit",
        },
      };
    case "timer":
      return {
        id,
        type: "timer",
        position,
        data: {
          label: "Timers",
          defaultMinutes: 25,
          lastLabel: undefined,
        },
      };
    case "bookmark":
      return {
        id,
        type: "bookmark",
        position,
        data: {
          label: "Bookmarks",
          lastTags: [],
        },
      };
    case "todo":
      return {
        id,
        type: "todo",
        position,
        data: {
          label: "Todo List",
          filter: "all",
        },
      };
    case "workflow":
      return {
        id,
        type: "workflow",
        position,
        data: { label: "Workflow", status: "Idle", messages: [] },
      };
    case "settings":
      return {
        id,
        type: "settings",
        position,
        data: { label: "Settings", autonomy: "low", voiceProvider: "local" },
      };
    case "privacy":
      return {
        id,
        type: "privacy",
        position,
        data: { label: "Privacy" },
      };
    case "profile":
      return {
        id,
        type: "profile",
        position,
        data: { label: "Profile" },
      };
    case "integrations":
      return {
        id,
        type: "integrations",
        position,
        data: { label: "Integrations" },
      };
    case "workflowlist":
      return {
        id,
        type: "workflowlist",
        position,
        data: { label: "Workflows", filter: "all" },
      };
    case "deployment":
      return {
        id,
        type: "deployment",
        position,
        data: { label: "Deployments", liveHealth: false },
      };
    case "concept":
      return {
        id,
        type: "concept",
        position,
        data: {
          label: "New Concept",
          entityType: "concept",
          confidence: 1.0,
          description: "A new concept in the knowledge graph.",
        },
      };
    default:
      return null;
  }
}

function getSpawnPosition(nodeCount: number) {
  const angle = (nodeCount % 12) * ((2 * Math.PI) / 12);
  const ring = Math.floor(nodeCount / 12) + 1;
  const radius = 320 + ring * 120;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}
