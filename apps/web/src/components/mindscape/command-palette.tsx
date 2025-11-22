import type { Node } from "@xyflow/react";
import {
  AlarmClock,
  BookMarked,
  BrainCircuit,
  ListChecks,
  MessageSquare,
  Network,
  PlugZap,
  Rows3,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  StickyNote,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { memo, useEffect, useDeferredValue, useMemo, useState } from "react";
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
import { useCommandUsage } from "@/hooks/use-command-usage";
import { PrefixTrie } from "@/lib/trie";
import { type ArtifactData, useMindscapeStore } from "@/store/mindscape";
import type { MindscapeSpawnType } from "./spawn";

const createActions: Array<{
  type: MindscapeSpawnType;
  label: string;
  description: string;
  icon: ReactNode;
  aliases?: string[];
}> = [
// ... (createActions items)
];

// ... (PaletteInput component)

type MindscapeCommandPaletteProps = {
  nodes: Node<ArtifactData>[];
  onSpawn: (type: MindscapeSpawnType) => string | null;
  onFocus: (nodeId: string) => void;
};

export function MindscapeCommandPalette({
  nodes,
  onSpawn,
  onFocus,
}: MindscapeCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const deferredInputValue = useDeferredValue(inputValue);
  const focusedNodeId = useMindscapeStore((state) => state.focusedNodeId);
  const edges = useMindscapeStore((state) => state.edges);
  const removeArtifact = useMindscapeStore((state) => state.removeArtifact);
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );
  const triggerPathActivity = useMindscapeStore(
    (state) => state.triggerPathActivity
  );
  const { getUsage, recordUsage } = useCommandUsage();

  const focusedNode = useMemo(
    () => (focusedNodeId ? nodes.find((n) => n.id === focusedNodeId) : null),
    [focusedNodeId, nodes]
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
      action.aliases?.forEach((alias) => trie.insert(alias, action.label, score));
    }

    // 2. Index Create Actions
    for (const action of createActions) {
      const score = usage[action.label] || 0;
      trie.insert(action.label, action.label, score);
      action.aliases?.forEach((alias) => trie.insert(alias, action.label, score));
    }

    return trie;
  }, [contextActions]); // Rebuild on context change (usage update on next mount/context change)

  // Calculate text completion suggestion (O(K))
  const suggestion = useMemo(() => {
    if (!inputValue) return;
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
      nodes
        .filter((node) => node.id !== "singularity")
        .map((node) => ({
          id: node.id,
          label:
            (typeof (node.data as ArtifactData | undefined)?.label === "string"
              ? (node.data as ArtifactData).label
              : undefined) ?? node.id,
          type: node.type ?? "artifact",
        })),
    [nodes]
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

  const executeContextAction = (actionId: ContextActionId) => {
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
      case "simulate-activation": {
        const path = [focusedNode.id];
        let currentId = focusedNode.id;

        // Walk 4 steps
        for (let i = 0; i < 4; i++) {
          const connectedEdges = edges.filter(
            (e) => e.source === currentId || e.target === currentId
          );
          if (connectedEdges.length === 0) break;

          // Prefer edges connecting to nodes not in path
          const candidates = connectedEdges.filter((e) => {
            const target = e.source === currentId ? e.target : e.source;
            return !path.includes(target);
          });

          const edge =
            candidates.length > 0
              ? candidates[Math.floor(Math.random() * candidates.length)]
              : connectedEdges[Math.floor(Math.random() * connectedEdges.length)];

          const nextId = edge.source === currentId ? edge.target : edge.source;
          if (!path.includes(nextId)) {
            path.push(nextId);
            currentId = nextId;
          } else {
            break;
          }
        }

        if (path.length > 1) {
          triggerPathActivity(path);
          toast.success(`Simulating activation path: ${path.length} nodes`);
        } else {
          toast.info("No connected nodes to traverse");
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
        value={inputValue}
        placeholder={
          focusedNode
            ? `Command ${focusedNode.data.label}...`
            : "Create or jump to a node"
        }
        onValueChange={setInputValue}
        suggestion={suggestion}
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
                  onSelect={() => executeContextAction(action.id)}
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
