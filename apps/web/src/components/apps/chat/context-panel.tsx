"use client";

/**
 * Context Panel - RAG context and knowledge facts display
 */

import type { AssistantUIMessage } from "@alfred/agent";
import { computeBudgetUsage } from "@alfred/history/budget";
import { Brain, Database, FileText, Link, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CompactKnowledgeGraph } from "@/components/graphs/knowledge/compact";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

// Tabs component placeholder - will use actual tabs when available
const Tabs = ({
  children,
  className,
  defaultValue,
}: {
  children: React.ReactNode;
  className?: string;
  defaultValue: string;
}) => (
  <div className={className} data-default-value={defaultValue}>
    {children}
  </div>
);
const TabsList = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`flex gap-1 ${className}`}>{children}</div>;
const TabsTrigger = ({
  children,
  className,
  value,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  value: string;
  onClick?: () => void;
}) => (
  <button
    className={`rounded px-2 py-1 text-biolum-dim hover:bg-white/5 hover:text-biolum ${className}`}
    data-value={value}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);
const TabsContent = ({
  children,
  className,
  value,
  active,
}: {
  children: React.ReactNode;
  className?: string;
  value: string;
  active?: boolean;
}) =>
  active ? (
    <div className={className} data-value={value}>
      {children}
    </div>
  ) : null;

type ContextPanelProps = {
  messages: AssistantUIMessage[];
  onClose: () => void;
  className?: string;
  searchQuery?: string;
};

const typeIcons = {
  document: FileText,
  url: Link,
  knowledge: Brain,
  fact: Database,
};

export function ContextPanel({
  messages,
  onClose,
  className,
  searchQuery,
}: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState("rag");

  // Get the last user message or a default query
  const queryText = useMemo(() => {
    if (searchQuery) {
      return searchQuery;
    }
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg && Array.isArray(lastUserMsg.parts)) {
      const textPart = lastUserMsg.parts.find(
        (p) => typeof p === "object" && "text" in p
      );
      if (textPart && typeof textPart === "object" && "text" in textPart) {
        return (textPart as { text: string }).text;
      }
    }
    return "alfred architecture";
  }, [searchQuery, messages]);

  // Fetch context items
  const { data: contextData, isLoading: isLoadingContext } =
    trpc.graph.getContext.useQuery(
      { text: queryText, topK: 5 },
      { enabled: activeTab === "rag" }
    );

  // Fetch knowledge graph data
  const { data: graphData, isLoading: isLoadingGraph } =
    trpc.graph.getGraphVisualization.useQuery(
      { text: queryText, topK: 10 },
      { enabled: activeTab === "knowledge" }
    );

  // Compute budget usage client-side
  const budgetUsage = useMemo(
    () => computeBudgetUsage(messages, 128_000),
    [messages]
  );

  const contextItems = contextData?.items ?? [];

  return (
    <div className={cn("flex flex-col bg-void-surface", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <span className="font-medium text-biolum text-sm">Context</span>
        <Button
          className="h-6 w-6"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs className="flex-1" defaultValue="rag">
        <TabsList className="mx-2 mt-2 h-8 w-auto">
          <TabsTrigger
            className={cn(
              "text-xs",
              activeTab === "rag" && "bg-white/10 text-biolum"
            )}
            onClick={() => setActiveTab("rag")}
            value="rag"
          >
            RAG
          </TabsTrigger>
          <TabsTrigger
            className={cn(
              "text-xs",
              activeTab === "knowledge" && "bg-white/10 text-biolum"
            )}
            onClick={() => setActiveTab("knowledge")}
            value="knowledge"
          >
            Knowledge
          </TabsTrigger>
          <TabsTrigger
            className={cn(
              "text-xs",
              activeTab === "history" && "bg-white/10 text-biolum"
            )}
            onClick={() => setActiveTab("history")}
            value="history"
          >
            History
          </TabsTrigger>
        </TabsList>

        {/* RAG Context */}
        <TabsContent
          active={activeTab === "rag"}
          className="flex-1 p-0"
          value="rag"
        >
          <ScrollArea className="h-full">
            <div className="p-2">
              {isLoadingContext && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
                </div>
              )}
              {!isLoadingContext && contextItems.length === 0 && (
                <div className="py-4 text-center text-biolum-dim text-sm">
                  No context found
                </div>
              )}
              {contextItems.map((item) => {
                const Icon = typeIcons[item.type];
                return (
                  <div
                    className="mb-2 rounded-lg border border-white/5 bg-white/5 p-2"
                    key={item.id}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-biolum-dim" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {item.title}
                          </span>
                          <span className="text-biolum-dim text-xs">
                            {Math.round(item.relevance * 100)}%
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-biolum-dim text-xs">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Knowledge Graph */}
        <TabsContent
          active={activeTab === "knowledge"}
          className="flex-1 p-0"
          value="knowledge"
        >
          {isLoadingGraph && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {!isLoadingGraph && (
            <CompactKnowledgeGraph
              data={{
                nodes: graphData?.nodes ?? [],
                edges: graphData?.edges ?? [],
              }}
            />
          )}
        </TabsContent>

        {/* History Budget */}
        <TabsContent
          active={activeTab === "history"}
          className="flex-1 p-2"
          value="history"
        >
          <div className="space-y-2">
            <div className="rounded-lg border border-white/5 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">History Budget</span>
                <span className="font-medium text-biolum">
                  {messages.length} messages
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-biolum transition-all"
                  style={{ width: `${budgetUsage.usagePercentage}%` }}
                />
              </div>
              <p className="mt-1 text-biolum-dim text-xs">
                {budgetUsage.usagePercentage.toFixed(0)}% of context window used
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Token Usage</span>
                <span className="font-medium text-biolum">
                  ~{(budgetUsage.total / 1000).toFixed(1)}k
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {budgetUsage.breakdown.map((seg) => (
                  <div
                    className="flex items-center justify-between text-xs"
                    key={seg.segment}
                  >
                    <span className="text-biolum-dim capitalize">
                      {seg.segment}
                    </span>
                    <span className="text-biolum">
                      {seg.tokens.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
