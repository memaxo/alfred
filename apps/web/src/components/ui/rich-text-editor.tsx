import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Underline,
  Undo,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type ToolbarAction =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "ordered"
  | "quote"
  | "link"
  | "divider"
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-justify"
  | "undo"
  | "redo";

export type RichTextToolbarProps = {
  onAction: (action: ToolbarAction, value?: string) => void;
  activeActions?: Set<ToolbarAction>;
  className?: string;
  compact?: boolean;
};

const actionIcons: Record<
  Exclude<ToolbarAction, "divider">,
  React.ReactNode
> = {
  bold: <Bold className="h-4 w-4" />,
  italic: <Italic className="h-4 w-4" />,
  underline: <Underline className="h-4 w-4" />,
  strikethrough: <Strikethrough className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  h1: <Heading1 className="h-4 w-4" />,
  h2: <Heading2 className="h-4 w-4" />,
  h3: "H3",
  bullet: <List className="h-4 w-4" />,
  ordered: <ListOrdered className="h-4 w-4" />,
  quote: <Quote className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
  "align-left": <AlignLeft className="h-4 w-4" />,
  "align-center": <AlignCenter className="h-4 w-4" />,
  "align-right": <AlignRight className="h-4 w-4" />,
  "align-justify": <AlignJustify className="h-4 w-4" />,
  undo: <Undo className="h-4 w-4" />,
  redo: <Redo className="h-4 w-4" />,
};

export function RichTextToolbar({
  onAction,
  activeActions = new Set(),
  className,
  compact = false,
}: RichTextToolbarProps) {
  const createActionHandler = (action: ToolbarAction) => () => {
    onAction(action);
  };

  const formatGroups = [
    ["bold", "italic", "underline", "strikethrough"] as const,
    ["h1", "h2", "h3"] as const,
    ["bullet", "ordered", "quote"] as const,
    ["align-left", "align-center", "align-right", "align-justify"] as const,
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 border-white/10 border-b bg-void-surface/30 px-2 py-1",
        compact && "gap-0",
        className
      )}
    >
      <div className="flex gap-1">
        <Button
          className={cn(compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0")}
          onClick={createActionHandler("undo")}
          size="sm"
          variant="ghost"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          className={cn(compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0")}
          onClick={createActionHandler("redo")}
          size="sm"
          variant="ghost"
        >
          <Redo className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-white/10" />
      </div>

      {formatGroups.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          <div className="flex gap-1">
            {group.map((action) => (
              <Button
                className={cn(
                  compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0",
                  "font-medium"
                )}
                key={action}
                onClick={createActionHandler(action)}
                size="sm"
                title={action
                  .split("-")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
                variant={activeActions.has(action) ? "secondary" : "ghost"}
              >
                {actionIcons[action]}
              </Button>
            ))}
          </div>
          {groupIndex < formatGroups.length - 1 && (
            <div className="mx-1 h-6 w-px bg-white/10" />
          )}
        </React.Fragment>
      ))}

      <div className="flex gap-1">
        <Button
          className={cn(compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0")}
          onClick={createActionHandler("link")}
          size="sm"
          title="Insert Link"
          variant="ghost"
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button
          className={cn(compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0")}
          onClick={createActionHandler("divider")}
          size="sm"
          title="Insert Divider"
          variant="ghost"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={cn(
                compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0",
                "font-mono text-xs"
              )}
              size="sm"
              variant="ghost"
            >
              &lt;/&gt;
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={createActionHandler("code")}>
              Inline Code
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("code", "block")}>
              Code Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compactToolbar?: boolean;
  toolbarActions?: ToolbarAction[];
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  className,
  compactToolbar = false,
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const lastSyncedHtml = React.useRef<string | null>(null);

  const [activeActions, setActiveActions] = React.useState<Set<ToolbarAction>>(
    new Set()
  );

  const sanitizeHtml = React.useCallback((html: string): string => {
    if (html.length === 0) {
      return "";
    }

    const tpl = document.createElement("template");
    tpl.innerHTML = html;

    // Remove high-risk elements entirely.
    for (const el of Array.from(
      tpl.content.querySelectorAll("script,style,iframe,object,embed,link,meta")
    )) {
      el.remove();
    }

    // Strip event handlers and javascript: URLs.
    for (const el of Array.from(tpl.content.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();

        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
          continue;
        }

        if (
          (name === "href" || name === "src") &&
          (val.startsWith("javascript:") || val.startsWith("data:"))
        ) {
          el.removeAttribute(attr.name);
        }
      }
    }

    return tpl.innerHTML;
  }, []);

  React.useEffect(() => {
    const el = editorRef.current;
    if (!el) {
      return;
    }

    const next = sanitizeHtml(value ?? "");
    if (lastSyncedHtml.current === next) {
      return;
    }

    // Avoid stomping user selection when already in sync.
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }

    lastSyncedHtml.current = next;
  }, [sanitizeHtml, value]);

  const handleSelectionChange = React.useCallback(() => {
    const newActiveActions = new Set<ToolbarAction>();

    if (document.queryCommandState("bold")) {
      newActiveActions.add("bold");
    }
    if (document.queryCommandState("italic")) {
      newActiveActions.add("italic");
    }
    if (document.queryCommandState("underline")) {
      newActiveActions.add("underline");
    }
    if (document.queryCommandState("strikeThrough")) {
      newActiveActions.add("strikethrough");
    }
    if (document.queryCommandValue("formatBlock") === "H1") {
      newActiveActions.add("h1");
    }
    if (document.queryCommandValue("formatBlock") === "H2") {
      newActiveActions.add("h2");
    }
    if (document.queryCommandValue("formatBlock") === "H3") {
      newActiveActions.add("h3");
    }

    setActiveActions(newActiveActions);
  }, []);

  const execCommand = React.useCallback(
    (command: string, value?: string) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleSelectionChange();
    },
    [handleSelectionChange]
  );

  const handleAction = React.useCallback(
    (action: ToolbarAction, actionValue?: string) => {
      const commandMap: Record<ToolbarAction, string | [string, string]> = {
        bold: "bold",
        italic: "italic",
        underline: "underline",
        strikethrough: "strikeThrough",
        code: "insertHTML",
        h1: "formatBlock",
        h2: "formatBlock",
        h3: "formatBlock",
        bullet: "insertUnorderedList",
        ordered: "insertOrderedList",
        quote: "formatBlock",
        link: "createLink",
        divider: "insertHorizontalRule",
        "align-left": "justifyLeft",
        "align-center": "justifyCenter",
        "align-right": "justifyRight",
        "align-justify": "justifyFull",
        undo: "undo",
        redo: "redo",
      };

      const command = commandMap[action];

      if (action === "link") {
        const url = prompt("Enter URL:");
        if (url) {
          execCommand("createLink", url);
        }
      } else if (action === "code") {
        const selection = window.getSelection();
        const selected = selection?.toString() ?? "";
        if (selected.length > 0) {
          const code = `<code>${selected}</code>`;
          execCommand("insertHTML", code);
        }
      } else if (action === "divider") {
        execCommand("insertHorizontalRule", "");
      } else if (Array.isArray(command)) {
        execCommand(command[0], actionValue ?? command[1]);
      } else if (action === "h1" || action === "h2" || action === "h3") {
        const headingMap = {
          h1: "<h1>",
          h2: "<h2>",
          h3: "<h3>",
        } as const;
        execCommand("formatBlock", headingMap[action]);
      } else if (action === "quote") {
        execCommand("formatBlock", "<blockquote>");
      } else {
        execCommand(command);
      }
    },
    [execCommand]
  );

  const handleInput = React.useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const next = sanitizeHtml(e.currentTarget.innerHTML);
      lastSyncedHtml.current = next;
      onChange(next);
    },
    [onChange, sanitizeHtml]
  );

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-white/10",
        className
      )}
    >
      <RichTextToolbar
        activeActions={activeActions}
        compact={compactToolbar}
        onAction={handleAction}
      />
      <div
        className="prose prose-invert min-h-[200px] max-w-none bg-transparent p-4 text-biolum focus:outline-none"
        contentEditable
        onInput={handleInput}
        onKeyUp={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        ref={editorRef}
        suppressContentEditableWarning
      />
      {!value && (
        <div
          className="pointer-events-none absolute top-12 left-4 select-none text-biolum-faint/50"
          onClick={() => editorRef.current?.focus()}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
}
