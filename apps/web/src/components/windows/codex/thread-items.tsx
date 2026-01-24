import type {
  AgentMessageItem,
  CommandExecutionItem,
  ErrorItem,
  FileChangeItem,
  McpToolCallItem,
  ReasoningItem,
  ThreadItem,
  TodoListItem,
  WebSearchItem,
} from "@alfred/protocol";

import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Code,
  ExternalLink,
  FileEdit,
  FilePlus,
  FileX,
  Loader2,
  MessageSquare,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type ThreadItemProps = {
  item: ThreadItem;
  expanded?: boolean;
};

function ReasoningItemView({ item }: { item: ReasoningItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const preview = item.text.slice(0, 100);
  const hasMore = item.text.length > 100;

  return (
    <div className="flex gap-2 text-biolum-dim text-xs">
      <Code className="mt-0.5 h-3 w-3 shrink-0" />
      <div className="min-w-0 flex-1">
        <button
          className="flex items-center gap-1 text-left hover:text-biolum"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="font-medium">Reasoning</span>
        </button>
        <div
          className={cn(
            "mt-1 whitespace-pre-wrap",
            !isExpanded && "line-clamp-2"
          )}
        >
          {isExpanded ? item.text : preview}
          {!isExpanded && hasMore && "..."}
        </div>
      </div>
    </div>
  );
}

function AgentMessageItemView({ item }: { item: AgentMessageItem }) {
  return (
    <div className="flex gap-2 text-sm">
      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-biolum" />
      <div className="min-w-0 flex-1 whitespace-pre-wrap">{item.text}</div>
    </div>
  );
}

function CommandExecutionItemView({ item }: { item: CommandExecutionItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusIcon =
    item.status === "in_progress" ? (
      <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
    ) : item.status === "completed" ? (
      <CheckCircle className="h-3 w-3 text-green-500" />
    ) : (
      <AlertCircle className="h-3 w-3 text-red-500" />
    );

  return (
    <div className="rounded bg-zinc-900/50 p-2 text-xs">
      <button
        className="flex w-full items-center gap-2"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <Terminal className="h-3 w-3 text-biolum" />
        <code className="flex-1 truncate text-left font-mono">
          {item.command}
        </code>
        {statusIcon}
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {isExpanded && item.aggregated_output && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-xs text-zinc-300">
          {item.aggregated_output}
        </pre>
      )}
      {item.exit_code !== undefined && (
        <div className="mt-1 text-biolum-dim">Exit code: {item.exit_code}</div>
      )}
    </div>
  );
}

function FileChangeItemView({ item }: { item: FileChangeItem }) {
  return (
    <div className="rounded bg-zinc-900/50 p-2 text-xs">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <FileEdit className="h-3 w-3 text-biolum" />
        File Changes
        {item.status === "completed" ? (
          <CheckCircle className="h-3 w-3 text-green-500" />
        ) : (
          <AlertCircle className="h-3 w-3 text-red-500" />
        )}
      </div>
      <div className="space-y-1">
        {item.changes.map((change, i) => (
          <div className="flex items-center gap-2" key={i}>
            {change.kind === "add" && (
              <FilePlus className="h-3 w-3 text-green-500" />
            )}
            {change.kind === "delete" && (
              <FileX className="h-3 w-3 text-red-500" />
            )}
            {change.kind === "update" && (
              <FileEdit className="h-3 w-3 text-yellow-500" />
            )}
            <span className="truncate font-mono">{change.path}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function McpToolCallItemView({ item }: { item: McpToolCallItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusIcon =
    item.status === "in_progress" ? (
      <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
    ) : item.status === "completed" ? (
      <CheckCircle className="h-3 w-3 text-green-500" />
    ) : (
      <AlertCircle className="h-3 w-3 text-red-500" />
    );

  return (
    <div className="rounded bg-zinc-900/50 p-2 text-xs">
      <button
        className="flex w-full items-center gap-2"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <Wrench className="h-3 w-3 text-biolum" />
        <span className="flex-1 truncate text-left">
          <span className="text-biolum-dim">{item.server}/</span>
          <span className="font-medium">{item.tool}</span>
        </span>
        {statusIcon}
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {item.arguments !== undefined && item.arguments !== null && (
            <div>
              <div className="mb-1 text-biolum-dim">Arguments:</div>
              <pre className="max-h-20 overflow-auto rounded bg-zinc-950 p-1 font-mono">
                {JSON.stringify(item.arguments, null, 2)}
              </pre>
            </div>
          )}
          {item.result && (
            <div>
              <div className="mb-1 text-biolum-dim">Result:</div>
              <pre className="max-h-40 overflow-auto rounded bg-zinc-950 p-1 font-mono">
                {JSON.stringify(item.result, null, 2)}
              </pre>
            </div>
          )}
          {item.error && (
            <div className="text-red-400">Error: {item.error.message}</div>
          )}
        </div>
      )}
    </div>
  );
}

function WebSearchItemView({ item }: { item: WebSearchItem }) {
  return (
    <div className="flex items-center gap-2 text-biolum-dim text-xs">
      <Search className="h-3 w-3" />
      <span>Searching: {item.query}</span>
      <ExternalLink className="h-3 w-3" />
    </div>
  );
}

function TodoListItemView({ item }: { item: TodoListItem }) {
  return (
    <div className="rounded bg-zinc-900/50 p-2 text-xs">
      <div className="mb-1 font-medium">Todo List</div>
      <div className="space-y-1">
        {item.items.map((todo, i) => (
          <div className="flex items-center gap-2" key={i}>
            <input
              checked={todo.completed}
              className="h-3 w-3"
              readOnly
              type="checkbox"
            />
            <span
              className={cn(todo.completed && "text-biolum-dim line-through")}
            >
              {todo.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorItemView({ item }: { item: ErrorItem }) {
  return (
    <div className="flex gap-2 rounded bg-red-500/10 p-2 text-red-400 text-xs">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{item.message}</div>
    </div>
  );
}

export function ThreadItemView({ item }: ThreadItemProps) {
  switch (item.type) {
    case "reasoning":
      return <ReasoningItemView item={item} />;
    case "agent_message":
      return <AgentMessageItemView item={item} />;
    case "command_execution":
      return <CommandExecutionItemView item={item} />;
    case "file_change":
      return <FileChangeItemView item={item} />;
    case "mcp_tool_call":
      return <McpToolCallItemView item={item} />;
    case "web_search":
      return <WebSearchItemView item={item} />;
    case "todo_list":
      return <TodoListItemView item={item} />;
    case "error":
      return <ErrorItemView item={item} />;
    default:
      return null;
  }
}

export function ThreadItemList({ items }: { items: ThreadItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center text-biolum-faint text-sm">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ThreadItemView item={item} key={item.id} />
      ))}
    </div>
  );
}
