import { Check, Code2, Copy } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  lineNumbers?: boolean;
  height?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = "plaintext",
  placeholder = "// Type code here...",
  readOnly = false,
  className,
  lineNumbers = true,
  height = "300px",
}: CodeEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [lineCount, setLineCount] = React.useState(1);

  React.useEffect(() => {
    setLineCount(value.split("\n").length);
  }, [value]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart ?? 0;
      const end = textareaRef.current?.selectionEnd ?? 0;
      const newValue = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(newValue);
      requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  const lineNumbersArray = React.useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount]
  );

  const getLanguageColor = React.useCallback((lang: string): string => {
    const colors: Record<string, string> = {
      javascript: "#f7df1e",
      typescript: "#3178c6",
      python: "#3776ab",
      html: "#e34c26",
      css: "#264de4",
      json: "#f7df1e",
      markdown: "#083fa1",
      plaintext: "#888888",
    };
    const lowerLang = lang.toLowerCase();
    return colors[lowerLang] ?? "#888888";
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-void-surface/50",
        className
      )}
      style={{ height }}
    >
      <div className="flex items-center justify-between border-white/10 border-b bg-void-surface/80 px-4 py-2">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: getLanguageColor(language) }}
          />
          <span className="font-medium text-biolum-dim text-xs">
            {language}
          </span>
        </div>
        <button
          className="flex items-center gap-1 text-biolum-dim text-xs transition-colors hover:text-biolum"
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </button>
      </div>

      <div className="relative flex h-[calc(100%-40px)]">
        {lineNumbers && (
          <div className="flex select-none flex-col items-end justify-start border-white/5 border-r bg-void-surface/30 px-2 py-4">
            {lineNumbersArray.map((line) => (
              <span className="font-mono text-biolum-faint text-xs" key={line}>
                {line}
              </span>
            ))}
          </div>
        )}

        <div className="relative flex-1">
          {!value && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-biolum-faint/40">
                <Code2 className="h-5 w-5" />
                <span className="font-mono text-sm">{placeholder}</span>
              </div>
            </div>
          )}

          <textarea
            className={cn(
              "h-full w-full bg-transparent px-4 py-4 font-mono text-biolum text-sm leading-relaxed",
              "resize-none focus:outline-none",
              lineNumbers && "pl-4"
            )}
            onChange={handleChange}
            onKeyDown={handleTab}
            placeholder=""
            readOnly={readOnly}
            ref={textareaRef}
            spellCheck={false}
            style={{
              tabSize: 2,
            }}
            value={value}
          />
        </div>
      </div>
    </div>
  );
}
