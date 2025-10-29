/**
 * Inline Citation Component
 * 
 * Adapted from ai-sdk.dev/elements/components/inline-citation
 * Displays inline citations from agent responses
 */

import { cn } from "@/lib/utils";

interface CiteProps {
  source: string;
  text: string;
  className?: string;
}

export function Cite({ source, text, className }: CiteProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{text}</span>
      <a
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary underline"
      >
        [cite]
      </a>
    </span>
  );
}

