"use client";

import { ExternalLink, Plus, Target } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

interface FocusAppProps {
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
}

export function FocusApp({
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
}: FocusAppProps) {
  const utils = trpc.useUtils();
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);

  const activeSet = trpc.focus.active.useQuery();
  const focusSetId = activeSet.data?.id ?? null;

  const commitments = trpc.focus.commitmentList.useQuery(
    focusSetId ? { focusSetId } : undefined,
    { enabled: Boolean(focusSetId) }
  );
  const attention = trpc.attention.list.useQuery({ status: "open", limit: 50 });
  const deltas = trpc.delta.list.useQuery({ limit: 20 });

  trpc.attention.subscribe.useSubscription(undefined, {
    onData: () => {
      void utils.attention.list.invalidate();
    },
  });
  trpc.delta.subscribe.useSubscription(undefined, {
    onData: () => {
      void utils.delta.list.invalidate();
    },
  });

  const createSet = trpc.focus.create.useMutation({
    onSuccess: () => {
      void utils.focus.active.invalidate();
      void utils.focus.list.invalidate();
      toast.success("Focus set created");
    },
  });

  const createCommitment = trpc.focus.commitmentCreate.useMutation({
    onSuccess: () => {
      if (focusSetId) {
        void utils.focus.commitmentList.invalidate({ focusSetId });
      }
    },
  });

  const resolveAttention = trpc.attention.resolve.useMutation({
    onSuccess: () => {
      void utils.attention.list.invalidate();
    },
  });

  const [setTitle, setSetTitle] = useState("");
  const [commitmentTitle, setCommitmentTitle] = useState("");

  const canCreateCommitment = useMemo(
    () => Boolean(focusSetId) && commitmentTitle.trim().length > 0,
    [focusSetId, commitmentTitle]
  );

  const createCommitmentNow = useCallback(() => {
    if (!focusSetId) {
      return;
    }
    const title = commitmentTitle.trim();
    if (!title) {
      return;
    }
    createCommitment.mutate({
      focusSetId,
      title,
      lane: "background",
      priority: 0,
    });
    setCommitmentTitle("");
  }, [commitmentTitle, createCommitment, focusSetId]);

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
          <Target className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Focus</span>
        </div>
      </div>

      {activeSet.data ? (
        <div className="grid h-[calc(100%-40px)] grid-cols-3 gap-3 p-3">
          <div className="flex min-w-0 flex-col rounded-md border border-white/10 bg-void-surface">
            <div className="flex items-center justify-between border-white/5 border-b px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-sm">
                  {activeSet.data.title ?? "Active Focus Set"}
                </div>
                <div className="text-[11px] text-white/50">
                  WIP limit {activeSet.data.wipLimit}
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-white/5 border-b p-3">
              <Input
                onChange={(e) => setCommitmentTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    createCommitmentNow();
                  }
                }}
                placeholder="New commitment…"
                value={commitmentTitle}
              />
              <Button
                disabled={!canCreateCommitment || createCommitment.isPending}
                onClick={createCommitmentNow}
                size="icon"
                variant="ghost"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-3">
                {(commitments.data ?? []).length === 0 ? (
                  <div className="text-sm text-white/50">
                    No commitments yet.
                  </div>
                ) : (
                  commitments.data?.map((c) => (
                    <div
                      className="rounded border border-white/10 bg-black/20 px-3 py-2"
                      key={c.id}
                    >
                      <div className="truncate text-sm">{c.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
                        <span>{c.lane}</span>
                        <span>•</span>
                        <span>{c.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex min-w-0 flex-col rounded-md border border-white/10 bg-void-surface">
            <div className="border-white/5 border-b px-3 py-2 font-medium text-sm">
              Attention
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-3">
                {(attention.data ?? []).length === 0 ? (
                  <div className="text-sm text-white/50">No open items.</div>
                ) : (
                  attention.data?.map((a) => (
                    <div
                      className="rounded border border-white/10 bg-black/20 px-3 py-2"
                      key={a.id}
                    >
                      <div className="truncate text-sm">
                        {a.title ?? a.kind}
                      </div>
                      {a.body ? (
                        <div className="mt-1 line-clamp-2 text-white/60 text-xs">
                          {a.body}
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-white/50">
                          {a.urgency}
                        </div>
                        <div className="flex items-center gap-2">
                          {a.workflowRunId ? (
                            <Button
                              onClick={() => {
                                spawnWindow("workflow", {
                                  type: "workflow_run",
                                  id: a.workflowRunId ?? "",
                                });
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open
                            </Button>
                          ) : null}
                          <Button
                            disabled={resolveAttention.isPending}
                            onClick={() =>
                              resolveAttention.mutate({ id: a.id })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex min-w-0 flex-col rounded-md border border-white/10 bg-void-surface">
            <div className="border-white/5 border-b px-3 py-2 font-medium text-sm">
              Delta
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-3">
                {(deltas.data ?? []).length === 0 ? (
                  <div className="text-sm text-white/50">No delta yet.</div>
                ) : (
                  deltas.data?.map((d) => (
                    <div
                      className="rounded border border-white/10 bg-black/20 px-3 py-2"
                      key={d.id}
                    >
                      <div className="text-white/50 text-xs">{d.scope}</div>
                      <div className="mt-1 text-sm">{d.summaryText}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="text-sm text-white/70">
            No active focus set. Create one to start tracking commitments.
          </div>
          <div className="flex gap-2">
            <Input
              onChange={(e) => setSetTitle(e.target.value)}
              placeholder="Focus set title (optional)"
              value={setTitle}
            />
            <Button
              disabled={createSet.isPending}
              onClick={() => {
                createSet.mutate({
                  title: setTitle.trim() ? setTitle.trim() : undefined,
                  wipLimit: 5,
                });
              }}
              variant="ghost"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FocusAppWindow(props: WindowComponentProps) {
  return <FocusApp {...props} className="h-full" />;
}
