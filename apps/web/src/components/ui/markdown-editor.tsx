import * as React from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  showToolbar?: boolean;
};

export const MarkdownEditor = ({
  value,
  onChange,
  placeholder = "Write markdown...",
  className,
  readOnly = false,
  showToolbar = true,
  ref,
}: MarkdownEditorProps & {
  ref?: React.RefObject<HTMLTextAreaElement | null>;
}) => {
  const [activeTab, setActiveTab] = React.useState<"write" | "preview">(
    "write"
  );

  const insertText = React.useCallback(
    (prefix: string, suffix = "") => {
      const textarea = ref as React.RefObject<HTMLTextAreaElement>;
      if (!textarea.current) {
        return;
      }

      const start = textarea.current.selectionStart;
      const end = textarea.current.selectionEnd;
      const selectedText = value.substring(start, end);

      const newValue =
        value.substring(0, start) +
        prefix +
        selectedText +
        suffix +
        value.substring(end);

      onChange(newValue);

      requestAnimationFrame(() => {
        textarea.current?.focus();
        const newCursorPos = start + prefix.length + selectedText.length;
        textarea.current?.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, onChange, ref]
  );

  const toolbarButtons = [
    { label: "B", action: () => insertText("**", "**"), title: "Bold" },
    { label: "I", action: () => insertText("*", "*"), title: "Italic" },
    { label: "H1", action: () => insertText("# ", ""), title: "Heading 1" },
    { label: "H2", action: () => insertText("## ", ""), title: "Heading 2" },
    { label: "`", action: () => insertText("`", "`"), title: "Code" },
    {
      label: "```",
      action: () => insertText("```\n", "\n```"),
      title: "Code block",
    },
    { label: "[]", action: () => insertText("- ", ""), title: "List" },
    { label: "[", action: () => insertText("[", "](url)"), title: "Link" },
  ];

  const renderPreview = () => {
    const renderInline = (text: string): React.ReactNode[] => {
      const nodes: React.ReactNode[] = [];
      let i = 0;

      const pushText = (chunk: string) => {
        if (chunk.length > 0) {
          nodes.push(chunk);
        }
      };

      const safeLink = (href: string): string | null => {
        if (href.trim().length === 0) {
          return null;
        }
        try {
          const url = new URL(href);
          return url.protocol === "http:" || url.protocol === "https:"
            ? url.toString()
            : null;
        } catch {
          return null;
        }
      };

      while (i < text.length) {
        // Inline code: `code`
        if (text[i] === "`") {
          const end = text.indexOf("`", i + 1);
          if (end !== -1) {
            const code = text.slice(i + 1, end);
            nodes.push(
              <code
                className="rounded bg-white/5 px-1 py-0.5 font-mono text-xs"
                key={`code-${i}`}
              >
                {code}
              </code>
            );
            i = end + 1;
            continue;
          }
        }

        // Bold: **text**
        if (text.startsWith("**", i)) {
          const end = text.indexOf("**", i + 2);
          if (end !== -1) {
            const bold = text.slice(i + 2, end);
            nodes.push(<strong key={`b-${i}`}>{bold}</strong>);
            i = end + 2;
            continue;
          }
        }

        // Italic: *text*
        if (text[i] === "*" && !text.startsWith("**", i)) {
          const end = text.indexOf("*", i + 1);
          if (end !== -1) {
            const italic = text.slice(i + 1, end);
            nodes.push(<em key={`i-${i}`}>{italic}</em>);
            i = end + 1;
            continue;
          }
        }

        // Link: [text](url)
        if (text[i] === "[") {
          const closeBracket = text.indexOf("]", i + 1);
          const openParen =
            closeBracket === -1 ? -1 : text.indexOf("(", closeBracket + 1);
          const closeParen =
            openParen === -1 ? -1 : text.indexOf(")", openParen + 1);

          if (
            closeBracket !== -1 &&
            openParen === closeBracket + 1 &&
            closeParen !== -1
          ) {
            const label = text.slice(i + 1, closeBracket);
            const hrefRaw = text.slice(openParen + 1, closeParen);
            const href = safeLink(hrefRaw);

            if (href) {
              nodes.push(
                <a
                  className="text-biolum hover:underline"
                  href={href}
                  key={`a-${i}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {label}
                </a>
              );
              i = closeParen + 1;
              continue;
            }
          }
        }

        // Plain text fallback (coalesce contiguous text for fewer nodes)
        const nextSpecial = (() => {
          const indices = [
            text.indexOf("`", i),
            text.indexOf("*", i),
            text.indexOf("[", i),
          ].filter((n) => n !== -1);
          return indices.length === 0 ? -1 : Math.min(...indices);
        })();

        if (nextSpecial === -1) {
          pushText(text.slice(i));
          break;
        }

        pushText(text.slice(i, nextSpecial));
        i = nextSpecial;
      }

      return nodes.length > 0 ? nodes : [text];
    };

    const lines = value.split("\n");
    return (
      <div className="prose prose-invert max-w-none text-biolum">
        {lines.map((line, index) => {
          if (!line.trim()) {
            return <br key={index} />;
          }

          if (line.startsWith("### ")) {
            return <h3 key={index}>{line.replace("### ", "")}</h3>;
          }
          if (line.startsWith("## ")) {
            return <h2 key={index}>{line.replace("## ", "")}</h2>;
          }
          if (line.startsWith("# ")) {
            return <h1 key={index}>{line.replace("# ", "")}</h1>;
          }
          if (line.startsWith("- ")) {
            return <li key={index}>{line.replace("- ", "")}</li>;
          }
          if (line.startsWith("> ")) {
            return (
              <blockquote key={index}>{line.replace("> ", "")}</blockquote>
            );
          }

          return <p key={index}>{renderInline(line)}</p>;
        })}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-white/10",
        className
      )}
    >
      {showToolbar && (
        <div className="flex items-center justify-between border-white/10 border-b bg-void-surface/30 px-2 py-1.5">
          {readOnly ? (
            <div className="flex gap-1">
              <Button
                onClick={() => setActiveTab("write")}
                size="sm"
                variant={activeTab === "write" ? "secondary" : "ghost"}
              >
                Write
              </Button>
              <Button
                onClick={() => setActiveTab("preview")}
                size="sm"
                variant={activeTab === "preview" ? "secondary" : "ghost"}
              >
                Preview
              </Button>
            </div>
          ) : (
            <span className="px-2 font-medium text-biolum-dim text-xs">
              Markdown
            </span>
          )}
          {!readOnly && (
            <div className="flex gap-1">
              {toolbarButtons.map((btn) => (
                <Button
                  className="h-7 w-7 p-0 font-mono text-xs"
                  key={btn.label}
                  onClick={btn.action}
                  size="sm"
                  title={btn.title}
                  variant="ghost"
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="min-h-[120px]">
        {activeTab === "write" || !readOnly ? (
          <textarea
            className={cn(
              "h-full min-h-[120px] w-full resize-y bg-transparent p-4 text-biolum",
              "focus:outline-none focus:ring-2 focus:ring-biolum focus:ring-inset",
              "font-mono text-sm leading-relaxed"
            )}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            ref={ref}
            value={value}
          />
        ) : (
          <div className="min-h-[120px] overflow-auto p-4">
            {renderPreview()}
          </div>
        )}
      </div>
    </div>
  );
};

MarkdownEditor.displayName = "MarkdownEditor";
