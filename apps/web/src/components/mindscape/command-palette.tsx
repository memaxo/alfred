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
  {
    type: "chat",
    label: "New Chat",
    description: "Spin up a fresh Neural Stream",
    icon: <MessageSquare className="h-4 w-4" />,
    aliases: ["start chat", "conversation", "talk"],
  },
  {
    type: "note",
    label: "New Note",
    description: "Capture thoughts inline",
    icon: <StickyNote className="h-4 w-4" />,
    aliases: ["write", "memo", "draft"],
  },
  {
    type: "reminder",
    label: "New Reminder",
    description: "Schedule follow-ups",
    icon: <AlarmClock className="h-4 w-4" />,
    aliases: ["alarm", "alert", "schedule"],
  },
  {
    type: "timer",
    label: "Timer Board",
    description: "Start and monitor focus timers",
    icon: <AlarmClock className="h-4 w-4" />,
    aliases: ["stopwatch", "countdown", "focus"],
  },
  {
    type: "bookmark",
    label: "Bookmark Node",
    description: "Save links you need later",
    icon: <BookMarked className="h-4 w-4" />,
    aliases: ["link", "url", "save"],
  },
  {
    type: "todo",
    label: "Todo List",
    description: "Track quick tasks",
    icon: <ListChecks className="h-4 w-4" />,
    aliases: ["task", "checklist", "do"],
  },
  {
    type: "settings",
    label: "Settings",
    description: "Adjust autonomy & preferences",
    icon: <SlidersHorizontal className="h-4 w-4" />,
    aliases: ["config", "preferences", "options"],
  },
  {
    type: "privacy",
    label: "Privacy",
    description: "Export or redact stored facts",
    icon: <ShieldCheck className="h-4 w-4" />,
    aliases: ["security", "data", "gdpr"],
  },
  {
    type: "profile",
    label: "Profile",
    description: "Update identity & passkeys",
    icon: <UserRound className="h-4 w-4" />,
    aliases: ["account", "user", "identity"],
  },
  {
    type: "integrations",
    label: "Integrations",
    description: "Connect Linear and more",
    icon: <PlugZap className="h-4 w-4" />,
    aliases: ["connections", "apps", "plugins"],
  },
  {
    type: "workflowlist",
    label: "Workflow List",
    description: "Browse and reopen runs",
    icon: <Rows3 className="h-4 w-4" />,
    aliases: ["runs", "history", "automations"],
  },
  {
    type: "deployment",
    label: "Deployments",
    description: "Monitor environments",
    icon: <ServerCog className="h-4 w-4" />,
    aliases: ["servers", "infra", "status"],
  },
  {
    type: "workflow",
    label: "New Workflow",
    description: "Plan or rerun automations",
    icon: <Network className="h-4 w-4" />,
    aliases: ["run", "execute", "automate"],
  },
  {
    type: "concept",
    label: "Visualize Concept",
    description: "Spawn a concept node",
    icon: <BrainCircuit className="h-4 w-4" />,
    aliases: ["idea", "map", "thought"],
  },
];

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
  const focusedNodeId = useMindscapeStore((state) => state.focusedNodeId);
  const removeArtifact = useMindscapeStore((state) => state.removeArtifact);
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

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

    // 1. Index Context Actions
    for (const action of contextActions) {
      trie.insert(action.label, action.label);
      action.aliases?.forEach((alias) => trie.insert(alias, action.label));
    }

    // 2. Index Create Actions
    for (const action of createActions) {
      trie.insert(action.label, action.label);
      action.aliases?.forEach((alias) => trie.insert(alias, action.label));
    }

    return trie;
  }, [contextActions]);

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
      default:
        toast.info(`Action ${actionId} triggered`);
    }
    setOpen(false);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && suggestion) {
      e.preventDefault();
      setInputValue(suggestion);
    }
  };

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandInput
        onKeyDown={handleKeyDown}
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
