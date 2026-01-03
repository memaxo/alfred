"use client";

/**
 * Context Panel - RAG context and knowledge facts display
 */

import type { AssistantUIMessage } from "@alfred/agent";
import { Brain, Database, FileText, Link, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
}: {
  children: React.ReactNode;
  className?: string;
  value: string;
}) => (
  <button
    className={`rounded px-2 py-1 text-biolum-dim hover:bg-white/5 hover:text-biolum ${className}`}
    data-value={value}
    type="button"
  >
    {children}
  </button>
);
const TabsContent = ({
  children,
  className,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  value: string;
}) => (
  <div className={className} data-value={value}>
    {children}
  </div>
);

type ContextPanelProps = {
  messages: AssistantUIMessage[];
  onClose: () => void;
  className?: string;
};

type ContextItem = {
  id: string;
  type: "document" | "url" | "knowledge" | "fact";
  title: string;
  content: string;
  relevance: number;
};

// Mock context for now
const mockContext: ContextItem[] = [
  {
    id: "1",
    type: "document",
    title: "desktop-evolution-prd.md",
    content: "Phase 2 defines core applications including chat, code editor...",
    relevance: 0.95,
  },
  {
    id: "2",
    type: "knowledge",
    title: "ALFRED Architecture",
    content: "Uses tRPC routers with SSE streaming for real-time updates",
    relevance: 0.88,
  },
  {
    id: "3",
    type: "url",
    title: "AI SDK Documentation",
    content: "https://sdk.vercel.ai/docs/ai-sdk-core",
    relevance: 0.82,
  },
];

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
}: ContextPanelProps) {
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
          <TabsTrigger className="text-xs" value="rag">
            RAG
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="knowledge">
            Knowledge
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="history">
            History
          </TabsTrigger>
        </TabsList>

        {/* RAG Context */}
        <TabsContent className="flex-1 p-0" value="rag">
          <ScrollArea className="h-full">
            <div className="p-2">
              {mockContext.map((item) => {
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
        <TabsContent className="flex-1 p-2" value="knowledge">
          <div className="flex h-full items-center justify-center text-biolum-dim text-sm">
            Knowledge graph visualization coming soon
          </div>
        </TabsContent>

        {/* History Budget */}
        <TabsContent className="flex-1 p-2" value="history">
          <div className="space-y-2">
            <div className="rounded-lg border border-white/5 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">History Budget</span>
                <span className="font-medium text-biolum">
                  {messages.length} / 50
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-biolum transition-all"
                  style={{ width: `${(messages.length / 50) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-biolum-dim text-xs">
                Messages are pruned when budget exceeds limit
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Token Usage</span>
                <span className="font-medium text-biolum">~12.4k</span>
              </div>
              <p className="mt-1 text-biolum-dim text-xs">
                Estimated tokens in current context
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
