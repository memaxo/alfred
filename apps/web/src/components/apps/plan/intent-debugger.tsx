"use client";

/**
 * Intent Debugger - Debug plan generation intents
 */

import { Bug, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IntentTrace {
  id: string;
  input: string;
  parsedIntent: string;
  confidence: number;
  steps: string[];
  warnings: string[];
}

const mockTrace: IntentTrace = {
  id: "1",
  input: "Add dark mode toggle to settings",
  parsedIntent: "feature.add",
  confidence: 0.92,
  steps: [
    "Parse user request for feature type",
    "Identify scope: settings component",
    "Generate UI modification plan",
    "Add state management hook",
    "Create toggle component",
    "Integrate with existing settings",
  ],
  warnings: ["No existing theme context found - may need to create one"],
};

export function IntentDebugger() {
  const [input, setInput] = useState("");
  const [trace, setTrace] = useState<IntentTrace | null>(mockTrace);

  const handleDebug = () => {
    // Mock debug - in real app would call backend
    setTrace(mockTrace);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Input */}
      <div className="border-white/5 border-b p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a task to debug intent parsing..."
            value={input}
          />
          <Button className="gap-1" onClick={handleDebug}>
            <Bug className="h-4 w-4" />
            Debug
          </Button>
        </div>
      </div>

      {/* Trace Output */}
      <ScrollArea className="flex-1">
        {trace ? (
          <div className="space-y-4 p-4">
            {/* Parsed Intent */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs uppercase tracking-wider">
                Parsed Intent
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg">{trace.parsedIntent}</span>
                <span className="text-biolum">
                  {(trace.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            </div>

            {/* Steps */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs uppercase tracking-wider">
                Generated Steps
              </div>
              <div className="space-y-1">
                {trace.steps.map((step, idx) => (
                  <div className="flex items-center gap-2 text-sm" key={idx}>
                    <ChevronRight className="h-3 w-3 text-biolum" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {trace.warnings.length > 0 && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                <div className="mb-2 text-xs text-yellow-400 uppercase tracking-wider">
                  Warnings
                </div>
                {trace.warnings.map((warning, idx) => (
                  <div className="text-sm text-yellow-400" key={idx}>
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            Enter a task and click Debug to trace intent parsing
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
