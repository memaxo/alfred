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
  "workflow",
] as const;

export type MindscapeSpawnType = (typeof mindscapeSpawnTypes)[number];

export type MindscapeSearchParams = {
  nodeId?: string;
  spawn?: MindscapeSpawnType;
  open?: string;
};

export const singletonSpawnTypes: MindscapeSpawnType[] = ["chat"];

const spawnLabels: Record<MindscapeSpawnType, string> = {
  chat: "Chat",
  note: "Note",
  reminder: "Reminder",
  timer: "Timer",
  bookmark: "Bookmark",
  todo: "Todo",
  workflow: "Workflow",
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
    case "workflow":
      return {
        id,
        type: "workflow",
        position,
        data: { label: "Workflow", status: "Idle", messages: [] },
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
