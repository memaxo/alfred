"use client";

/**
 * Query Editor - PromQL query editor
 */

import { Clock, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function QueryEditor() {
  const [query, setQuery] = useState("rate(http_requests_total[5m])");
  const [result, setResult] = useState<string | null>(null);

  const handleExecute = () => {
    // Mock result
    setResult(
      JSON.stringify(
        {
          status: "success",
          data: {
            resultType: "vector",
            result: [
              { metric: { method: "GET" }, value: [1_704_307_200, "42.5"] },
              { metric: { method: "POST" }, value: [1_704_307_200, "12.3"] },
            ],
          },
        },
        null,
        2
      )
    );
  };

  return (
    <div className="flex h-full flex-col p-4">
      {/* Query Input */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium text-sm">PromQL Query</span>
          <div className="flex items-center gap-2 text-biolum-dim text-xs">
            <Clock className="h-3 w-3" />
            Last 1h
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
          <Button className="gap-1" onClick={handleExecute}>
            <Play className="h-4 w-4" />
            Execute
          </Button>
        </div>
      </div>

      {/* Example Queries */}
      <div className="mb-4">
        <div className="mb-2 text-biolum-dim text-xs">Example Queries</div>
        <div className="flex flex-wrap gap-2">
          {[
            "rate(http_requests_total[5m])",
            "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "sum(active_connections) by (service)",
            "increase(agent_tasks_processed[1h])",
          ].map((q) => (
            <button
              className="rounded bg-white/5 px-2 py-1 font-mono text-xs hover:bg-white/10"
              key={q}
              onClick={() => setQuery(q)}
              type="button"
            >
              {q.slice(0, 30)}...
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="flex-1 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="mb-2 text-biolum-dim text-xs">Result</div>
          <pre className="overflow-auto font-mono text-sm">{result}</pre>
        </div>
      )}
    </div>
  );
}
