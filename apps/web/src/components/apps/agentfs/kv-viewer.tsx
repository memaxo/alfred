"use client";

/**
 * KV Viewer - Key-value store browser
 */

import { Database, Key, Loader2, Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import type { Workspace } from "./index";

type KVViewerProps = {
  workspace: Workspace;
  className?: string;
};

export function KVViewer({ workspace, className }: KVViewerProps) {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data, isLoading, error } = trpc.agentfs.kvList.useQuery({
    runId: workspace.runId,
    dbPath: workspace.dbPath,
  });

  const entries = data?.entries ?? [];
  const filteredEntries = entries.filter((e) =>
    e.key.toLowerCase().includes(search.toLowerCase())
  );

  const selectedEntry = entries.find((e) => e.key === selectedKey);

  return (
    <div className={cn("flex h-full", className)}>
      {/* Key list */}
      <div className="flex w-64 flex-col border-white/5 border-r">
        {/* Search */}
        <div className="border-white/5 border-b p-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
            <Input
              className="h-8 border-white/10 bg-white/5 pl-8 text-sm"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keys..."
              value={search}
            />
          </div>
        </div>

        {/* Entries */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
              </div>
            )}
            {error && (
              <div className="py-2 text-center text-red-400 text-xs">
                Failed to load entries
              </div>
            )}
            {!isLoading && filteredEntries.length === 0 && !error && (
              <div className="py-4 text-center text-biolum-dim text-xs">
                No entries
              </div>
            )}
            {filteredEntries.map((entry) => (
              <button
                className={cn(
                  "mb-1 flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors",
                  selectedKey === entry.key
                    ? "bg-biolum/10 text-biolum"
                    : "hover:bg-white/5"
                )}
                key={entry.key}
                onClick={() => setSelectedKey(entry.key)}
                type="button"
              >
                <Key className="h-3 w-3 flex-shrink-0 text-biolum-dim" />
                <span className="truncate font-mono text-xs">{entry.key}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Value viewer */}
      <div className="flex-1 p-4">
        {selectedEntry ? (
          <div>
            <div className="mb-4">
              <h3 className="font-medium font-mono">{selectedEntry.key}</h3>
              <p className="mt-1 text-biolum-dim text-xs">
                Type: <span className="text-biolum">{selectedEntry.type}</span>
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-void p-4 font-mono text-sm">
              <pre className="whitespace-pre-wrap text-biolum">
                {JSON.stringify(selectedEntry.value, null, 2)}
              </pre>
            </div>

            <p className="mt-2 text-biolum-faint text-xs">
              Last updated:{" "}
              {new Date(selectedEntry.updatedAt).toLocaleTimeString()}
            </p>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            <div className="text-center">
              <Database className="mx-auto mb-2 h-8 w-8 opacity-20" />
              <p className="text-sm">Select a key to view its value</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
