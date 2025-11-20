import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { BiolumBadge } from "@/components/tremor";

export type WorkflowError = {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp?: string;
  failedStep?: string;
  failedTool?: string;
};

export type WorkflowErrorPanelProps = {
  error: WorkflowError;
  runId: string;
  className?: string;
};

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

function getSuggestedSolutions(errorMessage: string): string[] {
  const lowerMessage = errorMessage.toLowerCase();
  
  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return commonIssues.timeout;
  }
  if (lowerMessage.includes("auth") || lowerMessage.includes("unauthorized")) {
    return commonIssues.authentication;
  }
  if (lowerMessage.includes("forbidden") || lowerMessage.includes("permission")) {
    return commonIssues.permission;
  }
  if (lowerMessage.includes("network") || lowerMessage.includes("connect")) {
    return commonIssues.network;
  }
  
  return [
    "Review the error details below",
    "Check workflow logs for more context",
    "Try rerunning the workflow",
  ];
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
            <h3 className="text-red-400 text-lg font-medium tracking-tight">
              Workflow Failed
            </h3>
            <p className="text-red-300 mt-1">{error.message}</p>
            {error.timestamp && (
              <p className="text-red-400/60 text-xs mt-2">
                {new Date(error.timestamp).toLocaleString()}
              </p>
            )}
          </div>
          <BiolumBadge variant="error">Error</BiolumBadge>
        </div>
      </div>

      {/* Suggested Solutions */}
      <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6">
        <h4 className="text-biolum text-sm font-medium mb-3">
          Suggested Solutions
        </h4>
        <ul className="space-y-2">
          {suggestions.map((solution, idx) => (
            <li key={idx} className="flex gap-2 text-biolum-dim text-sm">
              <span className="text-biolum">•</span>
              {solution}
            </li>
          ))}
        </ul>
      </div>

      {/* Affected Resources */}
      {(error.failedStep || error.failedTool) && (
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6">
          <h4 className="text-biolum text-sm font-medium mb-3">
            Affected Resources
          </h4>
          <div className="space-y-2 text-sm">
            {error.failedStep && (
              <div>
                <span className="text-biolum-dim">Failed Step:</span>{" "}
                <span className="text-biolum font-mono">{error.failedStep}</span>
              </div>
            )}
            {error.failedTool && (
              <div>
                <span className="text-biolum-dim">Failed Tool:</span>{" "}
                <span className="text-biolum font-mono">{error.failedTool}</span>
              </div>
            )}
            <div>
              <span className="text-biolum-dim">Run ID:</span>{" "}
              <span className="text-biolum font-mono">{runId}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stack Trace (Collapsible) */}
      {error.stack && (
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowStack(!showStack)}
            className="flex w-full items-center justify-between p-6 text-left hover:bg-void-surface/60 transition-colors"
          >
            <h4 className="text-biolum text-sm font-medium">Stack Trace</h4>
            {showStack ? (
              <ChevronDown className="h-4 w-4 text-biolum-dim" />
            ) : (
              <ChevronRight className="h-4 w-4 text-biolum-dim" />
            )}
          </button>
          {showStack && (
            <div className="border-t border-white/10 p-6">
              <pre className="text-red-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {error.stack}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Context Data (Collapsible) */}
      {error.context && Object.keys(error.context).length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowContext(!showContext)}
            className="flex w-full items-center justify-between p-6 text-left hover:bg-void-surface/60 transition-colors"
          >
            <h4 className="text-biolum text-sm font-medium">Context Data</h4>
            {showContext ? (
              <ChevronDown className="h-4 w-4 text-biolum-dim" />
            ) : (
              <ChevronRight className="h-4 w-4 text-biolum-dim" />
            )}
          </button>
          {showContext && (
            <div className="border-t border-white/10 p-6">
              <pre className="text-biolum-dim text-xs font-mono overflow-x-auto">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

