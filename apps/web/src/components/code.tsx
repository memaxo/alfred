/**
 * Code Block Component
 *
 * Adapted from ai-sdk.dev/elements/components/code-block
 * Displays code snippets with syntax highlighting
 */

import { cn } from "@/lib/utils";

interface CodeProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function Code({
  code,
  language,
  showLineNumbers = false,
  className,
}: CodeProps) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-lg border", className)}
    >
      {language && (
        <div className="border-b bg-muted px-4 py-2">
          <span className="font-medium text-muted-foreground text-xs">
            {language}
          </span>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className={cn("text-sm", language && `language-${language}`)}>
          {code}
        </code>
      </pre>
    </div>
  );
}
