import type { Node } from "@xyflow/react";
import {
  AlarmClock,
  BookMarked,
  MessageSquare,
  Network,
  StickyNote,
  ListChecks,
  SlidersHorizontal,
  ShieldCheck,
  UserRound,
  PlugZap,
  Rows3,
  ServerCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ArtifactData } from "@/store/mindscape";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { MindscapeSpawnType } from "./spawn";

const createActions: Array<{
  type: MindscapeSpawnType;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    type: "chat",
    label: "New Chat",
    description: "Spin up a fresh Neural Stream",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    type: "note",
    label: "New Note",
    description: "Capture thoughts inline",
    icon: <StickyNote className="h-4 w-4" />,
  },
  {
    type: "reminder",
    label: "New Reminder",
    description: "Schedule follow-ups",
    icon: <AlarmClock className="h-4 w-4" />,
  },
  {
    type: "timer",
    label: "Timer Board",
    description: "Start and monitor focus timers",
    icon: <AlarmClock className="h-4 w-4" />,
  },
  {
    type: "bookmark",
    label: "Bookmark Node",
    description: "Save links you need later",
    icon: <BookMarked className="h-4 w-4" />,
  },
  {
    type: "todo",
    label: "Todo List",
    description: "Track quick tasks",
    icon: <ListChecks className="h-4 w-4" />,
  },
  {
    type: "settings",
    label: "Settings",
    description: "Adjust autonomy & preferences",
    icon: <SlidersHorizontal className="h-4 w-4" />,
  },
  {
    type: "privacy",
    label: "Privacy",
    description: "Export or redact stored facts",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    type: "profile",
    label: "Profile",
    description: "Update identity & passkeys",
    icon: <UserRound className="h-4 w-4" />,
  },
  {
    type: "integrations",
    label: "Integrations",
    description: "Connect Linear and more",
    icon: <PlugZap className="h-4 w-4" />,
  },
  {
    type: "workflowlist",
    label: "Workflow List",
    description: "Browse and reopen runs",
    icon: <Rows3 className="h-4 w-4" />,
  },
  {
    type: "deployment",
    label: "Deployments",
    description: "Monitor environments",
    icon: <ServerCog className="h-4 w-4" />,
  },
  {
    type: "workflow",
    label: "New Workflow",
    description: "Plan or rerun automations",
    icon: <Network className="h-4 w-4" />,
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

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
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
    }
  };

  const handleFocus = (nodeId: string) => {
    onFocus(nodeId);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Create or jump to a node" />
      <CommandList>
        <CommandEmpty>No matching artifacts</CommandEmpty>
        <CommandGroup heading="Create">
          {createActions.map((action) => (
            <CommandItem
              key={action.type}
              value={`create-${action.type}`}
              onSelect={() => handleSpawn(action.type)}
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
          <CommandGroup heading="Existing">
            {searchableNodes.map((node) => (
              <CommandItem
                key={node.id}
                value={`focus-${node.id}`}
                onSelect={() => handleFocus(node.id)}
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
