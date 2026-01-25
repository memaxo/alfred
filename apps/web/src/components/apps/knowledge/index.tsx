"use client";

/**
 * Knowledge Graph Application - Phase 4 Knowledge & Integration
 *
 * Interactive exploration of ALFRED's knowledge memory hypergraph.
 *
 * Features:
 * - Force-directed graph canvas
 * - Entity detail panel
 * - Semantic search
 * - Time slider for temporal navigation
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.6
 */

import { Brain, RefreshCw } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { EntityPanel } from "./entity-panel";
import { GraphCanvas } from "./graph-canvas";
import { InsightPanel } from "./insight-panel";
import { SearchBar } from "./search-bar";
import { TimeSlider } from "./time-slider";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface KnowledgeAppProps {
  windowId?: string;
  className?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: "concept" | "person" | "project" | "file" | "event";
  facts: Fact[];
  relations: Relation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Fact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: string;
  timestamp: Date;
}

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  strength: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function KnowledgeApp({
  windowId: _windowId,
  className,
}: KnowledgeAppProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [timeRange, setTimeRange] = useState<[Date, Date]>([
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    new Date(),
  ]);

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="knowledge"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Knowledge Graph</span>
        </div>

        <div className="flex items-center gap-2">
          <SearchBar className="w-64" />
          <Button
            className={cn(
              "h-7 gap-1 text-xs",
              showInsights && "bg-biolum/10 text-biolum"
            )}
            onClick={() => setShowInsights(!showInsights)}
            size="sm"
            variant="ghost"
          >
            <Brain className="h-3 w-3" />
            Insights
          </Button>
          <Button className="h-7 w-7" size="icon" variant="ghost">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Time Slider */}
      <TimeSlider
        className="border-white/5 border-b px-4 py-2"
        onChange={setTimeRange}
        value={timeRange}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph Canvas */}
        <GraphCanvas
          className="flex-1"
          onSelectEntity={setSelectedEntityId}
          selectedEntityId={selectedEntityId}
        />

        {/* Entity Panel */}
        {selectedEntityId && (
          <EntityPanel
            className="w-80 flex-shrink-0 border-white/5 border-l"
            entityId={selectedEntityId}
            onClose={() => setSelectedEntityId(null)}
          />
        )}

        {/* Insight Panel */}
        {showInsights && (
          <InsightPanel
            className="w-72 flex-shrink-0 border-white/5 border-l"
            onClose={() => setShowInsights(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function KnowledgeAppWindow(props: WindowComponentProps) {
  return <KnowledgeApp className="h-full" windowId={props.window.id} />;
}

export default KnowledgeApp;
