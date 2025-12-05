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
  "droid",
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
  "droid",
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
  droid: "Droid Exec",
  concept: "Concept",
};

/**
 * Node hierarchy tiers - determines visual prominence and distance from orb
 */
export type NodeTier = "primary" | "secondary" | "tertiary";

export const tierConfig: Record<
  NodeTier,
  {
    types: readonly MindscapeSpawnType[];
    radius: number;
    glowIntensity: number;
  }
> = {
  primary: {
    types: ["chat", "droid"] as const,
    radius: 200,
    glowIntensity: 1.0,
  },
  secondary: {
    types: ["workflow", "workflowlist", "note", "reminder", "todo"] as const,
    radius: 350,
    glowIntensity: 0.6,
  },
  tertiary: {
    types: [
      "settings",
      "privacy",
      "profile",
      "integrations",
      "timer",
      "bookmark",
      "deployment",
      "concept",
    ] as const,
    radius: 500,
    glowIntensity: 0.3,
  },
};

/**
 * Get the tier for a given spawn type
 */
export function getNodeTier(type: MindscapeSpawnType): NodeTier {
  for (const [tier, config] of Object.entries(tierConfig)) {
    if ((config.types as readonly string[]).includes(type)) {
      return tier as NodeTier;
    }
  }
  return "tertiary";
}

/**
 * Fixed angles for primary nodes (in radians)
 * Chat: right of orb (0), Droid: left of orb (PI)
 */
const primaryNodeAngles: Partial<Record<MindscapeSpawnType, number>> = {
  chat: 0,
  droid: Math.PI,
};

/**
 * Track how many nodes of each tier have been spawned for angle distribution
 */
const tierSpawnCounts: Record<NodeTier, number> = {
  primary: 0,
  secondary: 0,
  tertiary: 0,
};

export function formatSpawnLabel(type: MindscapeSpawnType): string {
  return spawnLabels[type];
}

export function createSpawnNode(
  type: MindscapeSpawnType,
  _nodeCount: number
): Node<ArtifactData> | null {
  const id = `${type}-${nanoid(6)}`;
  const position = getSpawnPositionForType(type);

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
    case "droid":
      return {
        id,
        type: "droid",
        position,
        data: {
          label: "Droid Exec",
          prompt: "",
          auto: "low",
          out: "text",
          status: "idle",
          log: [],
        },
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

/**
 * Get spawn position for a specific node type using tier-based layout
 */
function getSpawnPositionForType(type: MindscapeSpawnType) {
  const tier = getNodeTier(type);
  const config = tierConfig[tier];

  // Primary nodes have fixed angles
  const fixedAngle = primaryNodeAngles[type];
  if (tier === "primary" && fixedAngle !== undefined) {
    return {
      x: Math.cos(fixedAngle) * config.radius,
      y: Math.sin(fixedAngle) * config.radius,
    };
  }

  // Secondary and tertiary nodes distribute evenly around their ring
  const count = tierSpawnCounts[tier];
  tierSpawnCounts[tier] = count + 1;

  // Distribute nodes evenly, offset by tier to avoid overlaps
  const nodesPerRing = tier === "secondary" ? 8 : 12;
  const angleOffset = tier === "secondary" ? Math.PI / 8 : Math.PI / 12;
  const angle =
    angleOffset + (count % nodesPerRing) * ((2 * Math.PI) / nodesPerRing);

  // Add slight radius variation for multiple rings
  const ring = Math.floor(count / nodesPerRing);
  const radius = config.radius + ring * 80;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

/**
 * Reset spawn counts (call when clearing the canvas)
 */
export function resetSpawnCounts() {
  tierSpawnCounts.primary = 0;
  tierSpawnCounts.secondary = 0;
  tierSpawnCounts.tertiary = 0;
}

/**
 * CSS classes for tier-based visual hierarchy
 */
export const tierStyles: Record<
  NodeTier,
  { glow: string; border: string; color: string }
> = {
  primary: {
    glow: "shadow-[0_0_30px_rgba(0,255,136,0.4)]",
    border: "border-[#00FF88]/60",
    color: "#00FF88",
  },
  secondary: {
    glow: "shadow-[0_0_20px_rgba(255,255,255,0.2)]",
    border: "border-white/30",
    color: "#FFFFFF",
  },
  tertiary: {
    glow: "shadow-[0_0_10px_rgba(255,255,255,0.1)]",
    border: "border-white/15",
    color: "#888888",
  },
};

/**
 * Get tier styling for a node type
 */
export function getTierStyles(type: MindscapeSpawnType) {
  return tierStyles[getNodeTier(type)];
}
