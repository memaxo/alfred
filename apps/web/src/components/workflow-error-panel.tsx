import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { BiolumBadge } from "@/components/tremor";

export interface WorkflowError {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp?: string;
  failedStep?: string;
  failedTool?: string;
}

export interface WorkflowErrorPanelProps {
  error: WorkflowError;
  runId: string;
  className?: string;
}

const commonIssues: Record<string, string[]> = {
  timeout: [
    "Check if the workflow timeout is sufficient (default: 30 minutes)",
    "Verify that external APIs are responding",
    "Consider breaking the workflow into smaller steps",
  ],
  authentication: [
    "Verify that API keys are correctly configured",
    "Check if tokens have expired",
    "Ensure biometric elevation was completed",
  ],
  permission: [
    "Verify that the workflow has necessary permissions",
    "Check autonomy level settings",
    "Review policy configuration",
  ],
  network: [
    "Check network connectivity",
    "Verify API endpoints are accessible",
    "Check firewall rules",
  ],
};

const defaultSolutions = [
  "Review the error details below",
  "Check workflow logs for more context",
  "Try rerunning the workflow",
];

function getSuggestedSolutions(errorMessage: string): string[] {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return commonIssues.timeout ?? defaultSolutions;
  }
  if (lowerMessage.includes("auth") || lowerMessage.includes("unauthorized")) {
    return commonIssues.authentication ?? defaultSolutions;
  }
  if (
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("permission")
  ) {
    return commonIssues.permission ?? defaultSolutions;
  }
  if (lowerMessage.includes("network") || lowerMessage.includes("connect")) {
    return commonIssues.network ?? defaultSolutions;
  }

  return defaultSolutions;
}

export function WorkflowErrorPanel({
  error,
  runId,
  className,
}: WorkflowErrorPanelProps) {
  const [showStack, setShowStack] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const suggestions = getSuggestedSolutions(error.message);

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {/* Error Header */}
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-red-500/20 p-3">
            <AlertCircle className="h-6 w-6 text-red-400" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-lg text-red-400 tracking-tight">
              Workflow Failed
            </h3>
            <p className="mt-1 text-red-300">{error.message}</p>
            {error.timestamp && (
              <p className="mt-2 text-red-400/60 text-xs">
                {new Date(error.timestamp).toLocaleString()}
              </p>
            )}
          </div>
          <BiolumBadge variant="error">Error</BiolumBadge>
        </div>
      </div>

      {/* Suggested Solutions */}
      <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
        <h4 className="mb-3 font-medium text-biolum text-sm">
          Suggested Solutions
        </h4>
        <ul className="space-y-2">
          {suggestions.map((solution, idx) => (
            <li className="flex gap-2 text-biolum-dim text-sm" key={idx}>
              <span className="text-biolum">•</span>
              {solution}
            </li>
          ))}
        </ul>
      </div>

      {/* Affected Resources */}
      {(error.failedStep || error.failedTool) && (
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <h4 className="mb-3 font-medium text-biolum text-sm">
            Affected Resources
          </h4>
          <div className="space-y-2 text-sm">
            {error.failedStep && (
              <div>
                <span className="text-biolum-dim">Failed Step:</span>{" "}
                <span className="font-mono text-biolum">
                  {error.failedStep}
                </span>
              </div>
            )}
            {error.failedTool && (
              <div>
                <span className="text-biolum-dim">Failed Tool:</span>{" "}
                <span className="font-mono text-biolum">
                  {error.failedTool}
                </span>
              </div>
            )}
            <div>
              <span className="text-biolum-dim">Run ID:</span>{" "}
              <span className="font-mono text-biolum">{runId}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stack Trace (Collapsible) */}
      {error.stack && (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl">
          <button
            className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-void-surface/60"
            onClick={() => setShowStack(!showStack)}
            type="button"
          >
            <h4 className="font-medium text-biolum text-sm">Stack Trace</h4>
            {showStack ? (
              <ChevronDown className="h-4 w-4 text-biolum-dim" />
            ) : (
              <ChevronRight className="h-4 w-4 text-biolum-dim" />
            )}
          </button>
          {showStack && (
            <div className="border-white/10 border-t p-6">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-red-300 text-xs">
                {error.stack}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Context Data (Collapsible) */}
      {error.context && Object.keys(error.context).length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl">
          <button
            className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-void-surface/60"
            onClick={() => setShowContext(!showContext)}
            type="button"
          >
            <h4 className="font-medium text-biolum text-sm">Context Data</h4>
            {showContext ? (
              <ChevronDown className="h-4 w-4 text-biolum-dim" />
            ) : (
              <ChevronRight className="h-4 w-4 text-biolum-dim" />
            )}
          </button>
          {showContext && (
            <div className="border-white/10 border-t p-6">
              <pre className="overflow-x-auto font-mono text-biolum-dim text-xs">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
