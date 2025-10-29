/**
 * Reasoning Component
 * 
 * Adapted from ai-sdk.dev/elements/components/reasoning
 * Displays agent thinking and reasoning chain
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReasoningStep {
  id: string;
  thought: string;
  confidence?: number;
}

interface ThinkProps {
  reasoning: ReasoningStep[];
  className?: string;
}

export function Think({ reasoning, className }: ThinkProps) {
  if (reasoning.length === 0) return null;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Reasoning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reasoning.map((step, index) => (
          <div key={step.id} className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
              {index + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm">{step.thought}</p>
              {step.confidence !== undefined && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Confidence: {(step.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

