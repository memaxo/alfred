/**
 * Visual Config Section Component
 *
 * Collapsible section for grouping visual settings.
 * Follows the bioluminescent design system.
 */

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type VisualSectionProps = {
  /** Section title */
  title: string;
  /** Optional description */
  description?: string;
  /** Whether section starts expanded */
  defaultExpanded?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
};

export function VisualSection({
  title,
  description,
  defaultExpanded = true,
  children,
  className,
}: VisualSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-void-surface/40 backdrop-blur-sm",
        className
      )}
    >
      {/* Header */}
      <button
        className="flex w-full items-center justify-between gap-4 p-4 transition-colors hover:bg-biolum/5"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <div className="text-left">
          <h3 className="font-semibold text-biolum tracking-tight">{title}</h3>
          {description && (
            <p className="mt-0.5 text-biolum-faint text-xs">{description}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-biolum-dim transition-transform duration-200",
            expanded && "rotate-180"
          )}
          strokeWidth={1.5}
        />
      </button>

      {/* Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-4 border-white/5 border-t p-4 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}
