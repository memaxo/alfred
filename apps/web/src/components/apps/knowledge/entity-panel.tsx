"use client";

/**
 * Entity Panel - Selected entity details with facts and relations
 */

import { Brain, Link, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type EntityPanelProps = {
  entityId: string;
  onClose: () => void;
  className?: string;
};

// Mock entity data
const mockEntity = {
  id: "1",
  name: "ALFRED",
  type: "project",
  description: "AI-powered personal assistant with cognitive architecture",
  facts: [
    { id: "f1", predicate: "uses", object: "TypeScript", confidence: 0.95 },
    { id: "f2", predicate: "runs on", object: "Bun runtime", confidence: 0.92 },
    {
      id: "f3",
      predicate: "has component",
      object: "Desktop Shell",
      confidence: 0.88,
    },
    {
      id: "f4",
      predicate: "implements",
      object: "Cognitive Loop",
      confidence: 0.91,
    },
  ],
  relations: [
    { id: "r1", target: "Desktop Shell", type: "contains" },
    { id: "r2", target: "ReactFlow", type: "uses" },
    { id: "r3", target: "Jack", type: "created by" },
  ],
};

export function EntityPanel({
  entityId: _entityId,
  onClose,
  className,
}: EntityPanelProps) {
  return (
    <div className={cn("flex flex-col bg-void-surface", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="font-medium text-sm">{mockEntity.name}</span>
        </div>
        <Button
          className="h-6 w-6"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Description */}
          <p className="mb-4 text-biolum-dim text-sm">
            {mockEntity.description}
          </p>

          {/* Facts */}
          <div className="mb-4">
            <h4 className="mb-2 font-medium text-biolum text-xs uppercase tracking-wider">
              Facts
            </h4>
            <div className="space-y-2">
              {mockEntity.facts.map((fact) => (
                <div
                  className="rounded-lg border border-white/5 bg-white/5 p-2"
                  key={fact.id}
                >
                  <div className="text-sm">
                    <span className="text-biolum">{mockEntity.name}</span>
                    <span className="mx-1 text-biolum-dim">
                      {fact.predicate}
                    </span>
                    <span className="text-biolum">{fact.object}</span>
                  </div>
                  <div className="mt-1 text-biolum-faint text-xs">
                    Confidence: {(fact.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relations */}
          <div>
            <h4 className="mb-2 font-medium text-biolum text-xs uppercase tracking-wider">
              Relations
            </h4>
            <div className="space-y-2">
              {mockEntity.relations.map((relation) => (
                <button
                  className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/5 p-2 text-left hover:bg-white/10"
                  key={relation.id}
                  type="button"
                >
                  <Link className="h-3 w-3 text-biolum-dim" />
                  <span className="text-biolum-dim text-xs">
                    {relation.type}
                  </span>
                  <span className="text-biolum text-sm">{relation.target}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
