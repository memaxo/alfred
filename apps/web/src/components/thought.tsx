/**
 * Chain of Thought Component
 *
 * Adapted from ai-sdk.dev/elements/components/chain-of-thought
 * Displays reasoning chain with step-by-step analysis
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ThoughtStep = {
  id: string;
  step: number;
  thought: string;
  evidence?: string[];
};

type ThoughtProps = {
  thoughts: ThoughtStep[];
  className?: string;
};

export function Thought({ thoughts, className }: ThoughtProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Chain of Thought</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {thoughts.map((thought) => (
          <div className="space-y-2" key={thought.id}>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs">
                {thought.step}
              </div>
              <p className="text-sm">{thought.thought}</p>
            </div>
            {thought.evidence && thought.evidence.length > 0 && (
              <div className="ml-8 space-y-1">
                {thought.evidence.map((evidence, idx) => (
                  <p className="text-muted-foreground text-xs" key={idx}>
                    • {evidence}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
