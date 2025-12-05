import type { Node } from "@xyflow/react";
import {
  Bell,
  Bookmark,
  Bot,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  ListChecks,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Server,
  Settings,
  Shapes,
  Shield,
  Timer,
  UserCircle,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ArtifactData } from "@/store/mindscape";
import {
  formatSpawnLabel,
  getNodeTier,
  type MindscapeSpawnType,
  mindscapeSpawnTypes,
  type NodeTier,
  tierConfig,
} from "./spawn";

const nodeIcons: Record<MindscapeSpawnType, ReactNode> = {
  chat: <MessageSquare className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  reminder: <Bell className="h-4 w-4" />,
  timer: <Timer className="h-4 w-4" />,
  bookmark: <Bookmark className="h-4 w-4" />,
  todo: <CheckSquare className="h-4 w-4" />,
  workflow: <Workflow className="h-4 w-4" />,
  workflowlist: <ListChecks className="h-4 w-4" />,
  deployment: <Server className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  privacy: <Shield className="h-4 w-4" />,
  profile: <UserCircle className="h-4 w-4" />,
  integrations: <Plug className="h-4 w-4" />,
  concept: <Shapes className="h-4 w-4" />,
  droid: <Bot className="h-4 w-4" />,
};

const tierLabels: Record<NodeTier, string> = {
  primary: "Core",
  secondary: "Tools",
  tertiary: "Settings",
};

const tierGlowStyles: Record<NodeTier, string> = {
  primary: "shadow-[0_0_12px_rgba(0,255,136,0.4)]",
  secondary: "shadow-[0_0_8px_rgba(255,255,255,0.2)]",
  tertiary: "",
};

type NodePanelProps = {
  nodes: Node<ArtifactData>[];
  onSpawn: (type: MindscapeSpawnType) => string | null;
  onFocus: (nodeId: string) => void;
};

export function NodePanel({ nodes, onSpawn, onFocus }: NodePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<Set<NodeTier>>(
    new Set(["primary", "secondary"])
  );

  // Group nodes by tier
  const nodesByTier = useMemo(() => {
    const grouped: Record<NodeTier, Node<ArtifactData>[]> = {
      primary: [],
      secondary: [],
      tertiary: [],
    };

    for (const node of nodes) {
      if (node.type === "orb" || node.type === "knowledge") {
        continue;
      }
      const tier = getNodeTier(node.type as MindscapeSpawnType);
      grouped[tier].push(node);
    }

    return grouped;
  }, [nodes]);

  // Get available spawn types (not yet created singletons)
  const availableSpawnTypes = useMemo(() => {
    const existingTypes = new Set(nodes.map((n) => n.type));
    return mindscapeSpawnTypes.filter((type) => !existingTypes.has(type));
  }, [nodes]);

  const toggleTier = (tier: NodeTier) => {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  if (isCollapsed) {
    return (
      <button
        aria-label="Open node panel"
        className="fixed bottom-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-void-surface/80 text-biolum backdrop-blur-sm transition-all hover:border-white/20 hover:bg-void-surface"
        onClick={() => setIsCollapsed(false)}
        type="button"
      >
        <PanelLeftOpen className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-64 rounded-2xl border border-white/10 bg-void-surface/90 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-white/10 border-b px-4 py-3">
        <h3 className="font-medium text-biolum text-sm tracking-wide">Nodes</h3>
        <button
          aria-label="Collapse panel"
          className="text-biolum-dim transition-colors hover:text-biolum"
          onClick={() => setIsCollapsed(true)}
          type="button"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Tiers */}
      <div className="max-h-[400px] overflow-y-auto p-2">
        {(["primary", "secondary", "tertiary"] as const).map((tier) => {
          const tierNodes = nodesByTier[tier];
          const tierTypes = tierConfig[tier].types;
          const isExpanded = expandedTiers.has(tier);

          return (
            <div className="mb-2" key={tier}>
              {/* Tier Header */}
              <button
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                onClick={() => toggleTier(tier)}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      tier === "primary" && "bg-[#00FF88]",
                      tier === "secondary" && "bg-white/60",
                      tier === "tertiary" && "bg-white/30"
                    )}
                  />
                  <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
                    {tierLabels[tier]}
                  </span>
                  <span className="text-[10px] text-biolum-faint">
                    ({tierNodes.length})
                  </span>
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3 text-biolum-faint" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-biolum-faint" />
                )}
              </button>

              {/* Tier Content */}
              {isExpanded && (
                <div className="mt-1 space-y-0.5 pl-4">
                  {/* Existing nodes */}
                  {tierNodes.map((node) => (
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all hover:bg-white/10",
                        tierGlowStyles[tier]
                      )}
                      key={node.id}
                      onClick={() => onFocus(node.id)}
                      type="button"
                    >
                      <span className="text-biolum-dim">
                        {nodeIcons[node.type as MindscapeSpawnType]}
                      </span>
                      <span className="truncate text-biolum text-sm">
                        {(node.data as ArtifactData).label ?? node.type}
                      </span>
                    </button>
                  ))}

                  {/* Available spawn types for this tier */}
                  {tierTypes
                    .filter((t) => availableSpawnTypes.includes(t))
                    .map((type) => (
                      <button
                        className="flex w-full items-center gap-2 rounded-md border border-white/10 border-dashed px-2 py-1.5 text-left transition-all hover:border-white/20 hover:bg-white/5"
                        key={type}
                        onClick={() => onSpawn(type)}
                        type="button"
                      >
                        <span className="text-biolum-faint">
                          {nodeIcons[type]}
                        </span>
                        <span className="text-biolum-faint text-sm">
                          + {formatSpawnLabel(type)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="border-white/10 border-t px-4 py-2">
        <p className="text-center text-[10px] text-biolum-faint">
          Press{" "}
          <kbd className="rounded border border-white/20 bg-white/5 px-1 py-0.5 text-[9px]">
            ⌘K
          </kbd>{" "}
          for command palette
        </p>
      </div>
    </div>
  );
}
