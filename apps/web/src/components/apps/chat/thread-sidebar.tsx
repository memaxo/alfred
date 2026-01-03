"use client";

/**
 * Thread Sidebar - Conversation history navigation
 */

import { Clock, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Thread = {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  messageCount: number;
};

type ThreadSidebarProps = {
  onClose: () => void;
  className?: string;
};

// Mock threads for now
const mockThreads: Thread[] = [
  {
    id: "1",
    title: "Desktop Evolution",
    preview: "Let's discuss the new tiling window manager...",
    timestamp: new Date(),
    messageCount: 24,
  },
  {
    id: "2",
    title: "Agent Architecture",
    preview: "How should we structure the orchestrator?",
    timestamp: new Date(Date.now() - 86_400_000),
    messageCount: 15,
  },
  {
    id: "3",
    title: "Voice Integration",
    preview: "Testing the new speech-to-speech...",
    timestamp: new Date(Date.now() - 172_800_000),
    messageCount: 8,
  },
];

export function ThreadSidebar({ onClose, className }: ThreadSidebarProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredThreads = mockThreads.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.preview.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("flex flex-col bg-void-surface", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <span className="font-medium text-biolum text-sm">Threads</span>
        <Button
          className="h-6 w-6"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
          <Input
            className="h-8 border-white/10 bg-white/5 pl-8 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads..."
            value={search}
          />
        </div>
      </div>

      {/* New Thread Button */}
      <div className="px-2">
        <Button
          className="w-full justify-start gap-2"
          size="sm"
          variant="ghost"
        >
          <Plus className="h-4 w-4" />
          New Thread
        </Button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredThreads.map((thread) => (
            <button
              className={cn(
                "mb-1 w-full rounded-lg p-2 text-left transition-colors",
                selectedId === thread.id
                  ? "bg-biolum/10 text-biolum"
                  : "hover:bg-white/5"
              )}
              key={thread.id}
              onClick={() => setSelectedId(thread.id)}
              type="button"
            >
              <div className="flex items-start justify-between">
                <span className="font-medium text-sm">{thread.title}</span>
                <span className="text-biolum-dim text-xs">
                  {thread.messageCount}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-biolum-dim text-xs">
                {thread.preview}
              </p>
              <div className="mt-1 flex items-center gap-1 text-biolum-faint text-xs">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(thread.timestamp)}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (hours < 1) {
    return "Just now";
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  return date.toLocaleDateString();
}
