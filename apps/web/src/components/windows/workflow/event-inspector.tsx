"use client";

/**
 * Workflow Event Inspector
 *
 * Displays detailed workflow events for debugging and monitoring.
 * Shows event types, timestamps, and payload data.
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 4
 */

import {
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Play,
  Square,
  Terminal,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

interface WorkflowEvent {
  id: string;
  type: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface EventInspectorProps {
  events: WorkflowEvent[];
  isLoading?: boolean;
}

type EventFilter = "all" | "stage" | "agent" | "tool" | "system";

const eventTypeIcons: Record<string, React.ReactNode> = {
  "pipeline:start": <Play className="h-3 w-3 text-green-400" />,
  "pipeline:complete": <Square className="h-3 w-3 text-blue-400" />,
  "pipeline:failed": <Square className="h-3 w-3 text-red-400" />,
  "stage:progress": <Clock className="h-3 w-3 text-yellow-400" />,
  "agent:progress": <Terminal className="h-3 w-3 text-cyan-400" />,
  "tool-call": <Wrench className="h-3 w-3 text-purple-400" />,
  "tool-result": <Wrench className="h-3 w-3 text-green-400" />,
  default: <FileText className="h-3 w-3 text-gray-400" />,
};

function getEventIcon(type: string) {
  return eventTypeIcons[type] || eventTypeIcons.default;
}

function categorizeEvent(type: string): EventFilter {
  if (type.startsWith("stage:")) {
    return "stage";
  }
  if (type.startsWith("agent:")) {
    return "agent";
  }
  if (type.startsWith("tool")) {
    return "tool";
  }
  if (type.startsWith("pipeline:")) {
    return "system";
  }
  return "system";
}

export function EventInspector({ events, isLoading }: EventInspectorProps) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const filteredEvents = events.filter((event) => {
    // Category filter
    if (filter !== "all" && categorizeEvent(event.type) !== filter) {
      return false;
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesType = event.type.toLowerCase().includes(searchLower);
      const matchesData = event.data
        ? JSON.stringify(event.data).toLowerCase().includes(searchLower)
        : false;
      return matchesType || matchesData;
    }

    return true;
  });

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedEvents);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedEvents(next);
  };

  if (isLoading) {
    return (
      <div className="h-full rounded-xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading events...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 p-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="font-medium">Event Inspector</span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
              {filteredEvents.length}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-white/5 p-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as EventFilter)}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="stage">Stage</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="tool">Tool</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 flex-1"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedEvents(new Set())}
            className="h-8 px-2"
          >
            Collapse
          </Button>
        </div>

        {/* Events List */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {filteredEvents.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No events match your filters
              </div>
            ) : (
              filteredEvents.map((event, index) => (
                <EventRow
                  key={event.id || index}
                  event={event}
                  isExpanded={expandedEvents.has(event.id || String(index))}
                  onToggle={() => toggleExpanded(event.id || String(index))}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function EventRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: WorkflowEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasData = event.data && Object.keys(event.data).length > 0;

  return (
    <div className="rounded border border-white/5 bg-white/[0.02]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-white/5"
      >
        {hasData ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        ) : (
          <div className="w-3" />
        )}

        {getEventIcon(event.type)}

        <span className="text-xs font-medium">{event.type}</span>

        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </button>

      {isExpanded && hasData && (
        <div className="border-t border-white/5 px-2 py-2">
          <pre className="max-h-48 overflow-auto rounded bg-black/30 p-2 text-xs">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
