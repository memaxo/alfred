/**
 * Inline Citation Component
 *
 * Adapted from ai-sdk.dev/elements/components/inline-citation
 * Displays inline citations from agent responses
 */

import { cn } from "@/lib/utils";

type CiteProps = {
  source: string;
  text: string;
  className?: string;
};

export function Cite({ source, text, className }: CiteProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{text}</span>
      <a
        className="text-primary text-xs underline"
        href={source}
        rel="noopener noreferrer"
        target="_blank"
      >
        [cite]
      </a>
    </span>
  );
}
