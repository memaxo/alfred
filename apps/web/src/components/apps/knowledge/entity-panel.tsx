"use client";

/**
 * Entity Panel - Selected entity details with facts and relations
 */

import { Brain, Link, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type EntityPanelProps = {
  entityId: string;
  onClose: () => void;
  className?: string;
};

export function EntityPanel({
  entityId,
  onClose,
  className,
}: EntityPanelProps) {
  const { data, isLoading, error } = trpc.knowledge.entityGet.useQuery({
    entityId,
    resource: "default",
  });

  const entity = data ?? {
    id: entityId,
    name: "Loading...",
    type: "entity",
    description: null,
    facts: [],
    relations: [],
  };
  return (
    <div className={cn("flex flex-col bg-void-surface", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="font-medium text-sm">{entity.name}</span>
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
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-center text-red-400 text-xs">
              Failed to load entity
            </div>
          )}
          {!isLoading && entity && (
            <>
              {/* Description */}
              {entity.description && (
                <p className="mb-4 text-biolum-dim text-sm">
                  {entity.description}
                </p>
              )}

              {/* Facts */}
              <div className="mb-4">
                <h4 className="mb-2 font-medium text-biolum text-xs uppercase tracking-wider">
                  Facts
                </h4>
                <div className="space-y-2">
                  {entity.facts.length === 0 && (
                    <div className="text-biolum-dim text-xs">No facts</div>
                  )}
                  {entity.facts.map((fact) => (
                    <div
                      className="rounded-lg border border-white/5 bg-white/5 p-2"
                      key={fact.id}
                    >
                      <div className="text-sm">
                        <span className="text-biolum">{entity.name}</span>
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
                  {entity.relations.length === 0 && (
                    <div className="text-biolum-dim text-xs">No relations</div>
                  )}
                  {entity.relations.map((relation) => (
                    <button
                      className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/5 p-2 text-left hover:bg-white/10"
                      key={relation.id}
                      type="button"
                    >
                      <Link className="h-3 w-3 text-biolum-dim" />
                      <span className="text-biolum-dim text-xs">
                        {relation.type}
                      </span>
                      <span className="text-biolum text-sm">
                        {relation.target}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
