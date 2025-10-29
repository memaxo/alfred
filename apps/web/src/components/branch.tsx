/**
 * Branch Component
 * 
 * Adapted from ai-sdk.dev/elements/components/branch
 * Displays decision branches in reasoning
 */

import { cn } from "@/lib/utils";

interface BranchOption {
  id: string;
  label: string;
  reasoning: string;
  selected?: boolean;
}

interface BranchProps {
  branches: BranchOption[];
  className?: string;
}

export function Branch({ branches, className }: BranchProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {branches.map((branch) => (
        <div
          key={branch.id}
          className={cn(
            "rounded border p-3",
            branch.selected && "border-primary bg-primary/5",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{branch.label}</span>
            {branch.selected && (
              <span className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                Selected
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {branch.reasoning}
          </p>
        </div>
      ))}
    </div>
  );
}

