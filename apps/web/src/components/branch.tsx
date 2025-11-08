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
          className={cn(
            "rounded border p-3",
            branch.selected && "border-primary bg-primary/5"
          )}
          key={branch.id}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{branch.label}</span>
            {branch.selected && (
              <span className="rounded bg-primary px-2 py-1 text-primary-foreground text-xs">
                Selected
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            {branch.reasoning}
          </p>
        </div>
      ))}
    </div>
  );
}
