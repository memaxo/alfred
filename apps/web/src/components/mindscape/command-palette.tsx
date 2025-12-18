import {
  Bell,
  Bookmark,
  Bot,
  CheckSquare,
  FileText,
  ListChecks,
  MessageSquare,
  Plug,
  Server,
  Settings,
  Shapes,
  Shield,
  Timer,
  UserCircle,
  Workflow,
} from "lucide-react";
import type { Edge } from "@xyflow/react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { type ContextActionId, getActionsForNode } from "@/config/actions";
import { MINDSCAPE_CONFIG } from "@/config/mindscape";
import { useCommandUsage } from "@/hooks/use-command-usage";
import { PrefixTrie } from "@/lib/trie";
import { type ArtifactData, useMindscapeStore } from "@/store/mindscape";
import { trpc } from "@/utils/trpc";
import type { MindscapeSpawnType } from "./spawn";

type NoteData = Extract<ArtifactData, { type: "note" }>;
type KnowledgeData = Extract<ArtifactData, { type: "knowledge" }>;
type ConceptData = Extract<ArtifactData, { type: "concept" }>;

const createActions: Array<{
  type: MindscapeSpawnType;
  label: string;
  description: string;
  icon: ReactNode;
  aliases?: string[];
}> = [
  {
    type: "chat",
    label: "Chat",
    description: "Start a new Neural Stream conversation.",
    icon: <MessageSquare className="h-4 w-4" />,
    aliases: ["talk", "assistant"],
  },
  {
    type: "note",
    label: "Note",
    description: "Capture free-form text or findings.",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    type: "reminder",
    label: "Reminder",
    description: "Set a due time so Alfred pings you later.",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    type: "timer",
    label: "Timer",
    description: "Drop a focus timer into the canvas.",
    icon: <Timer className="h-4 w-4" />,
  },
  {
    type: "todo",
    label: "Todo",
    description: "Track actionable items inline.",
    icon: <CheckSquare className="h-4 w-4" />,
  },
  {
    type: "bookmark",
    label: "Bookmark",
    description: "Collect quick links and references.",
    icon: <Bookmark className="h-4 w-4" />,
  },
  {
    type: "workflow",
    label: "Workflow",
    description: "Launch a multi-step autonomous run.",
    icon: <Workflow className="h-4 w-4" />,
    aliases: ["plan", "run"],
  },
  {
    type: "workflowlist",
    label: "Workflow List",
    description: "Monitor every active workflow.",
    icon: <ListChecks className="h-4 w-4" />,
  },
  {
    type: "deployment",
    label: "Deployments",
    description: "Inspect release health and controls.",
    icon: <Server className="h-4 w-4" />,
  },
  {
    type: "settings",
    label: "Settings",
    description: "Adjust autonomy & voice preferences.",
    icon: <Settings className="h-4 w-4" />,
  },
  {
    type: "privacy",
    label: "Privacy",
    description: "Review data sharing and exports.",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    type: "profile",
    label: "Profile",
    description: "Manage identity & authentication.",
    icon: <UserCircle className="h-4 w-4" />,
  },
  {
    type: "integrations",
    label: "Integrations",
    description: "Wire Linear, GitHub, and more.",
    icon: <Plug className="h-4 w-4" />,
  },
  {
    type: "concept",
    label: "Concept",
    description: "Seed a new knowledge graph entity.",
    icon: <Shapes className="h-4 w-4" />,
  },
  {
    type: "droid",
    label: "Droid Exec",
    description: "Run the policy-gated droid executor.",
    icon: <Bot className="h-4 w-4" />,
    aliases: ["exec", "cli"],
  },
];

// ... (PaletteInput component)

type MindscapeCommandPaletteProps = {
  onSpawn: (type: MindscapeSpawnType) => string | null;
  onFocus: (nodeId: string) => void;
};

export function MindscapeCommandPalette({
  onSpawn,
  onFocus,
}: MindscapeCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const focusedNodeId = useMindscapeStore((state) => state.focusedNodeId);
  const addArtifact = useMindscapeStore((state) => state.addArtifact);
  const removeArtifact = useMindscapeStore((state) => state.removeArtifact);
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );
  const currentNodes = useMindscapeStore((state) => state.nodes);
  const edges = useMindscapeStore((state) => state.edges);
  const setEdges = useMindscapeStore((state) => state.setEdges);
  const { getUsage, recordUsage } = useCommandUsage();
  const { mutateAsync: visualizeKnowledge } = trpc.knowledge.visualize.useMutation();

  const focusedNode = useMemo(
    () =>
      focusedNodeId ? currentNodes.find((n) => n.id === focusedNodeId) : null,
    [focusedNodeId, currentNodes]
  );

  const contextActions = useMemo(() => {
    if (!focusedNode) {
      return [];
    }
    const type = focusedNode.type || (focusedNode.data as ArtifactData).type;
    if (!type) {
      return [];
    }
    return getActionsForNode(type as any);
  }, [focusedNode]);

  // Initialize Trie for O(K) lookups
  const commandTrie = useMemo(() => {
    const trie = new PrefixTrie<string>();
    const usage = getUsage();

    // 1. Index Context Actions
    for (const action of contextActions) {
      const score = usage[action.label] || 0;
      trie.insert(action.label, action.label, score);
      action.aliases?.forEach((alias) =>
        trie.insert(alias, action.label, score)
      );
    }

    // 2. Index Create Actions
    for (const action of createActions) {
      const score = usage[action.label] || 0;
      trie.insert(action.label, action.label, score);
      action.aliases?.forEach((alias) =>
        trie.insert(alias, action.label, score)
      );
    }

    return trie;
  }, [contextActions]); // Rebuild on context change (usage update on next mount/context change)

  // Calculate text completion suggestion (O(K))
  const suggestion = useMemo(() => {
    if (!inputValue) {
      return;
    }
    const match = commandTrie.findCompletion(inputValue);
    return match ? match.value : undefined;
  }, [inputValue, commandTrie]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        setInputValue("");
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const searchableNodes = useMemo(
    () =>
      currentNodes
        .filter((node) => node.id !== "singularity")
        .map((node) => ({
          id: node.id,
          label:
            (typeof (node.data as ArtifactData | undefined)?.label === "string"
              ? (node.data as ArtifactData).label
              : undefined) ?? node.id,
          type: node.type ?? "artifact",
        })),
    [currentNodes]
  );

  const handleSpawn = (type: MindscapeSpawnType) => {
    const action = createActions.find((a) => a.type === type);
    if (action) {
      recordUsage(action.label);
    }
    const id = onSpawn(type);
    if (id) {
      setOpen(false);
      setInputValue("");
    }
  };

  const handleFocus = (nodeId: string) => {
    onFocus(nodeId);
    setOpen(false);
    setInputValue("");
  };

  const executeContextAction = async (actionId: ContextActionId) => {
    if (!focusedNode) {
      return;
    }

    const action = contextActions.find((a) => a.id === actionId);
    if (action) {
      recordUsage(action.label);
    }

    switch (actionId) {
      case "delete":
        removeArtifact(focusedNode.id);
        toast.success("Node deleted");
        break;
      case "focus":
        onFocus(focusedNode.id);
        break;
      case "hide":
        removeArtifact(focusedNode.id);
        toast.success("Node hidden from graph");
        break;
      case "retry":
        if (focusedNode.type === "workflow") {
          updateArtifactData(focusedNode.id, { status: "pending" });
          toast.info("Workflow queued for retry");
        }
        break;
      case "clear-history":
        if (focusedNode.type === "chat") {
          updateArtifactData(focusedNode.id, { messages: [] });
          toast.success("Chat history cleared");
        }
        break;
      case "duplicate":
        if (focusedNode.type === "note") {
          toast.info("Duplication not yet implemented");
        }
        break;
      case "ask": {
        // 1. Find or spawn chat node
        let chatNodeId: string | null | undefined = currentNodes.find(
          (n) => n.type === "chat"
        )?.id;
        if (!chatNodeId) {
          chatNodeId = onSpawn("chat");
        }
        if (!chatNodeId) {
          return;
        }

        // 2. Connect chat node to current node (if different)
        if (focusedNode.id !== chatNodeId) {
          // Client-side optimistic edge creation
          const edgeId = `e-${chatNodeId}-${focusedNode.id}`;
          const newEdge = {
            id: edgeId,
            source: chatNodeId,
            target: focusedNode.id,
            type: "default",
            data: { kind: "relates_to" },
          };

          const exists = edges.some(
            (e) =>
              (e.source === chatNodeId && e.target === focusedNode.id) ||
              (e.source === focusedNode.id && e.target === chatNodeId)
          );

          if (!exists) {
            setEdges([...edges, newEdge]);
            toast.success(`Linked Chat to ${focusedNode.data.label}`);
          }
        }

        // 3. Focus the chat node
        onFocus(chatNodeId);
        break;
      }
      case "visualize": {
        try {
          const nodeType =
            focusedNode.type || (focusedNode.data as ArtifactData).type;
          const data = focusedNode.data as ArtifactData;

          let text = "";
          if (nodeType === "note") {
            const note = data as NoteData;
            text = [note.title ?? note.label, note.content]
              .filter(Boolean)
              .join("\n\n");
          } else if (nodeType === "knowledge") {
            const knowledge = data as KnowledgeData;
            text = [knowledge.label, knowledge.summary].filter(Boolean).join("\n\n");
          } else {
            text = [data.label].filter(Boolean).join("\n\n");
          }

          if (!text.trim()) {
            toast.info("No text available to visualize.");
            break;
          }

          const result = await visualizeKnowledge({
            text,
            resource: "user",
            limit: 20,
          });

          if (!result.nodes.length) {
            toast.info("No entities detected yet.");
            break;
          }

          const parentPos = focusedNode.position ?? { x: 0, y: 0 };
          const radius = MINDSCAPE_CONFIG.SPAWN_RADIUS;

          // Spawn concept nodes
          result.nodes.forEach((node, index) => {
            const uiId = `concept-${node.id}`;
            const exists = currentNodes.some((n) => n.id === uiId);
            if (exists) {
              return;
            }

            const angle = (index / result.nodes.length) * 2 * Math.PI;
            const x = parentPos.x + radius * Math.cos(angle);
            const y = parentPos.y + radius * Math.sin(angle);

            const conceptData: ConceptData = {
              type: "concept",
              label: node.label,
              entityType: node.entityType,
              confidence: node.confidence,
              archived: node.archived,
              description: node.description,
              graph: {
                resource: `concept:${node.id}`,
                dbId: node.id,
                hgHash: node.hgHash,
              },
            };

            addArtifact({
              id: uiId,
              type: "concept",
              position: { x, y },
              data: conceptData,
            });
          });

          // Merge concept edges + link focused node to concepts locally
          const edgeMap = new Map<string, Edge>(edges.map((edge) => [edge.id, edge]));

          for (const edge of result.edges) {
            const source = `concept-${edge.fromId}`;
            const target = `concept-${edge.toId}`;
            const nextEdge = {
              id: edge.id,
              source,
              target,
              type: "default",
              data: {
                kind: edge.kind,
                fromDbId: edge.fromId,
                toDbId: edge.toId,
              },
              style: { stroke: "rgba(255, 255, 255, 0.2)" },
            } satisfies Edge;
            edgeMap.set(nextEdge.id, nextEdge);
          }

          for (const node of result.nodes) {
            const conceptUiId = `concept-${node.id}`;
            const localId = `e-${focusedNode.id}-${conceptUiId}`;
            if (edgeMap.has(localId)) {
              continue;
            }
            const localEdge = {
              id: localId,
              source: focusedNode.id,
              target: conceptUiId,
              type: "default",
              data: {
                kind: "mentions",
              },
              style: { stroke: "rgba(99, 102, 241, 0.25)" },
            } satisfies Edge;
            edgeMap.set(localEdge.id, localEdge);
          }

          setEdges(Array.from(edgeMap.values()));
          toast.success("Knowledge visualized");
        } catch (error) {
          toast.error("Failed to visualize knowledge");
          console.error("visualize_action_failed", error);
        }
        break;
      }
      default:
        toast.info(`Action ${actionId} triggered`);
    }
    setOpen(false);
    setInputValue("");
  };

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandInput
        onValueChange={setInputValue}
        placeholder={
          focusedNode
            ? `Command ${focusedNode.data.label}...`
            : "Create or jump to a node"
        }
        suggestion={suggestion}
        value={inputValue}
      />
      <CommandList>
        <CommandEmpty>No matching commands</CommandEmpty>

        {focusedNode && contextActions.length > 0 && (
          <>
            <CommandGroup
              heading={`Actions for ${focusedNode.data.label || "Selected Node"}`}
            >
              {contextActions.map((action) => (
                <CommandItem
                  className={
                    action.variant === "destructive"
                      ? "text-red-400 aria-selected:text-red-400"
                      : ""
                  }
                  key={action.id}
                  keywords={action.aliases}
                  onSelect={() => void executeContextAction(action.id)}
                  value={`action-${action.id}`}
                >
                  <span className="mr-3 opacity-70">
                    <action.icon className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col text-left">
                    <span className="font-medium">{action.label}</span>
                  </span>
                  {action.shortcut && (
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Create">
          {createActions.map((action) => (
            <CommandItem
              key={action.type}
              keywords={action.aliases}
              onSelect={() => handleSpawn(action.type)}
              value={`create-${action.type}`}
            >
              <span className="mr-3 text-biolum">{action.icon}</span>
              <span className="flex flex-col text-left">
                <span className="font-medium">{action.label}</span>
                <span className="text-biolum-faint text-xs">
                  {action.description}
                </span>
              </span>
              <CommandShortcut>Enter</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {searchableNodes.length > 0 && (
          <CommandGroup heading="Jump to">
            {searchableNodes.map((node) => (
              <CommandItem
                key={node.id}
                onSelect={() => handleFocus(node.id)}
                value={`focus-${node.id}`}
              >
                <span className="mr-2 text-biolum-dim">●</span>
                <span>{node.label}</span>
                <CommandShortcut>{node.type}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
