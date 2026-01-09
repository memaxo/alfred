"use client";

/**
 * Query Editor - PromQL query editor
 */

import { AlertTriangle, Clock, Play } from "lucide-react";
import { useState } from "react";
import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

export function QueryEditor() {
  const [query, setQuery] = useState("rate(http_requests_total[5m])");
  const { data, error, isFetching, refetch } = trpc.admin.metricsQuery.useQuery(
    { query },
    {
      enabled: false,
      retry: false,
    }
  );

  const handleExecute = () => {
    refetch();
  };

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      {/* Query Input */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium text-sm">PromQL Query</span>
          <div className="flex items-center gap-2 text-biolum-dim text-xs">
            <Clock className="h-3 w-3" />
            Live Registry Snapshot
          </div>
        </div>
        <div className="flex gap-2">
          <textarea
            className="flex-1 rounded-lg border border-white/10 bg-white/5 p-3 font-mono text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter PromQL query..."
            rows={3}
            value={query}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            className="gap-1"
            disabled={isFetching}
            onClick={handleExecute}
          >
            <Play className={isFetching ? "animate-pulse" : "h-4 w-4"} />
            {isFetching ? "Executing..." : "Execute"}
          </Button>
        </div>
      </div>

      {/* Example Queries */}
      <div className="mb-4">
        <div className="mb-2 text-biolum-dim text-xs">Example Queries</div>
        <div className="flex flex-wrap gap-2">
          {[
            "http_requests_total",
            "active_connections",
            "agent_tasks_processed",
            "memory_usage_bytes",
          ].map((q) => (
            <button
              className="rounded bg-white/5 px-2 py-1 font-mono text-xs transition-colors hover:bg-white/10"
              key={q}
              onClick={() => setQuery(q)}
              type="button"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && !isBiometricError(error) && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-red-400 text-xs">
          <AlertTriangle className="h-4 w-4" />
          {error.message}
        </div>
      )}

      {/* Result */}
      {data && (
        <div className="flex-1 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between border-white/5 border-b pb-1 text-biolum-dim text-xs">
            <span>Result ({data.matchedCount} metrics matched)</span>
          </div>
          <pre className="mt-2 overflow-auto font-mono text-biolum-bright text-xs">
            {JSON.stringify(data.results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
