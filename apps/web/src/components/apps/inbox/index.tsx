import { Inbox as InboxIcon, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface InboxAppProps {
  className?: string;
  window?: WindowComponentProps["window"];
  onClose?: WindowComponentProps["onClose"];
  onMinimize?: WindowComponentProps["onMinimize"];
  onFocus?: WindowComponentProps["onFocus"];
  onBlur?: WindowComponentProps["onBlur"];
  onDragStart?: WindowComponentProps["onDragStart"];
  onDragEnd?: WindowComponentProps["onDragEnd"];
  onMaximize?: WindowComponentProps["onMaximize"];
  onRestore?: WindowComponentProps["onRestore"];
  onResizeStart?: WindowComponentProps["onResizeStart"];
  onResizeEnd?: WindowComponentProps["onResizeEnd"];
  onDataChange?: WindowComponentProps["onDataChange"];
}

function formatKind(kind: string) {
  if (kind === "voice") {
    return "Voice";
  }
  if (kind === "text") {
    return "Text";
  }
  if (kind === "photo") {
    return "Photo";
  }
  return kind;
}

function formatStatus(status: string) {
  if (status === "new") {
    return "New";
  }
  if (status === "triaged") {
    return "Triaged";
  }
  if (status === "converted") {
    return "Converted";
  }
  if (status === "archived") {
    return "Archived";
  }
  return status;
}

function formatDateLabel(value: unknown): string {
  if (value && typeof value === "object" && value instanceof Date) {
    return value.toLocaleString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toLocaleString() : String(value);
  }
  return String(value ?? "");
}

export function InboxApp({
  className,
  window,
  onClose,
  onMinimize,
  onFocus,
  onBlur,
  onDragStart,
  onDragEnd,
  onMaximize,
  onRestore,
  onResizeStart: _onResizeStart,
  onResizeEnd: _onResizeEnd,
  onDataChange: _onDataChange,
}: InboxAppProps) {
  const utils = trpc.useUtils();
  const inboxQuery = trpc.inbox.list.useQuery({});
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const triage = trpc.capture.triage.useMutation({
    onSuccess: async (result) => {
      toast.success(
        result.kind === "note"
          ? "Converted to note"
          : (result.kind === "reminder"
            ? "Converted to reminder"
            : "Converted")
      );
      await utils.inbox.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Conversion failed");
    },
    onSettled: () => {
      setConvertingId(null);
    },
  });

  trpc.inbox.subscribe.useSubscription(undefined, {
    onData: () => {
      void utils.inbox.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Inbox stream error: ${err.message}`);
    },
  });

  const items = useMemo(() => inboxQuery.data ?? [], [inboxQuery.data]);

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void", className)}
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(next)) {
          onBlur?.();
        }
      }}
      onFocusCapture={(e) => {
        const prev = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(prev)) {
          onFocus?.();
        }
      }}
      onKeyDownCapture={(e) => {
        if (e.key === "Escape") {
          onClose?.();
          return;
        }

        if ((e.metaKey || e.ctrlKey) && (e.key === "m" || e.key === "M")) {
          e.preventDefault();
          onMinimize?.();
          return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          if (!window) {
            return;
          }
          if (window.state === "maximized") {
            onRestore?.();
            return;
          }
          onMaximize?.();
        }
      }}
      onMouseDownCapture={() => onFocus?.()}
    >
      <div
        className="flex h-10 cursor-grab items-center justify-between border-white/5 border-b bg-void-surface px-3"
        onDoubleClick={() => {
          if (!window) {
            return;
          }
          if (window.state === "maximized") {
            onRestore?.();
            return;
          }
          onMaximize?.();
        }}
        onMouseDown={(e) => {
          onFocus?.();
          if (e.target !== e.currentTarget) {
            return;
          }
          onDragStart?.(e);
        }}
        onMouseUp={(e) => {
          if (e.target !== e.currentTarget) {
            return;
          }
          onDragEnd?.(e);
        }}
      >
        <div className="flex items-center gap-2">
          <InboxIcon className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Inbox</span>
        </div>
        <Button
          className="h-7 w-7"
          onClick={() => void inboxQuery.refetch()}
          size="icon"
          variant="ghost"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid gap-3 p-4">
          {inboxQuery.isLoading ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              Loading inbox...
            </div>
          ) : inboxQuery.isError ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              Failed to load inbox: {inboxQuery.error.message}
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              Inbox is empty
            </div>
          ) : (
            items.map((row) => (
              <div
                className="rounded-xl border border-white/10 bg-white/5 p-3"
                key={row.capture.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-biolum">
                        {formatKind(row.capture.kind)}
                      </span>
                      <span className="rounded bg-white/5 px-2 py-0.5 text-biolum-dim">
                        {formatStatus(row.capture.status)}
                      </span>
                      <span className="text-biolum-dim">
                        {formatDateLabel(row.capture.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-biolum text-sm">
                      {row.bundle?.text ?? "(No derived text yet)"}
                    </div>
                    {row.receipt?.summary ? (
                      <div className="mt-2 text-biolum-dim text-xs">
                        {row.receipt.summary}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      disabled={
                        convertingId === row.capture.id ||
                        triage.isPending ||
                        row.capture.status === "converted"
                      }
                      onClick={() => {
                        setConvertingId(row.capture.id);
                        triage.mutate({
                          captureId: row.capture.id,
                          destination: "note",
                        });
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      Create note
                    </Button>
                    <Button
                      disabled={
                        convertingId === row.capture.id ||
                        triage.isPending ||
                        row.capture.status === "converted"
                      }
                      onClick={() => {
                        setConvertingId(row.capture.id);
                        triage.mutate({
                          captureId: row.capture.id,
                          destination: "reminder",
                        });
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      Create reminder
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function InboxAppWindow(props: WindowComponentProps) {
  return <InboxApp {...props} className="h-full" />;
}
