"use client";

import { Pin, Save, Target, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type WorkingSetKind = "project" | "conversation" | "note" | "reminder" | "task";

type Item = {
  kind: WorkingSetKind;
  id: string;
  label?: string;
};

type WorkingSetAppProps = {
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
};

export function WorkingSetApp({
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
}: WorkingSetAppProps) {
  const utils = trpc.useUtils();
  const query = trpc.workingset.get.useQuery();
  const setMutation = trpc.workingset.set.useMutation({
    onSuccess: () => {
      void utils.workingset.get.invalidate();
      setDirty(false);
      toast.success("Working set saved");
    },
  });

  const [items, setItems] = useState<Item[]>([]);
  const [focusKey, setFocusKey] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  const [newKind, setNewKind] = useState<WorkingSetKind>("project");
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (!query.data) {
      return;
    }
    if (dirty) {
      return;
    }
    setItems(query.data.items as Item[]);
    setFocusKey(
      query.data.focus ? `${query.data.focus.kind}:${query.data.focus.id}` : ""
    );
  }, [query.data, dirty]);

  const addItem = useCallback(() => {
    const id = newId.trim();
    if (!id) {
      return;
    }
    const next: Item = {
      kind: newKind,
      id,
      label: newLabel.trim() || undefined,
    };
    setItems((prev) => {
      const withoutDup = prev.filter(
        (p) => !(p.kind === next.kind && p.id === next.id)
      );
      return [...withoutDup, next].slice(0, 20);
    });
    setDirty(true);
    setNewId("");
    setNewLabel("");
  }, [newId, newKind, newLabel]);

  const removeItem = useCallback(
    (kind: WorkingSetKind, id: string) => {
      setItems((prev) => prev.filter((p) => !(p.kind === kind && p.id === id)));
      setDirty(true);
      const key = `${kind}:${id}`;
      if (focusKey === key) {
        setFocusKey("");
      }
    },
    [focusKey]
  );

  const setFocus = useCallback((key: string) => {
    setFocusKey(key);
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    const focus = focusKey
      ? items.find((i) => `${i.kind}:${i.id}` === focusKey)
      : undefined;
    setMutation.mutate({
      items,
      focus,
    });
  }, [items, focusKey, setMutation]);

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
          <span className="font-medium text-sm">Working Set</span>
        </div>
        <Button
          className="h-7 gap-2"
          disabled={setMutation.isPending}
          onClick={save}
          size="sm"
          variant="ghost"
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      <div className="space-y-3 border-white/5 border-b p-4">
        <div className="grid gap-2 md:grid-cols-3">
          <Select
            onValueChange={(v) => setNewKind(v as WorkingSetKind)}
            value={newKind}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">project</SelectItem>
              <SelectItem value="conversation">conversation</SelectItem>
              <SelectItem value="note">note</SelectItem>
              <SelectItem value="reminder">reminder</SelectItem>
              <SelectItem value="task">task</SelectItem>
            </SelectContent>
          </Select>
          <Input
            onChange={(e) => setNewId(e.target.value)}
            placeholder="ID"
            value={newId}
          />
          <Input
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            value={newLabel}
          />
        </div>
        <Button
          className="w-full"
          disabled={!newId.trim()}
          onClick={addItem}
          variant="secondary"
        >
          <Pin className="mr-2 h-4 w-4" />
          Pin item
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid gap-2 p-4">
          {query.isLoading ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              Loading working set...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              No pinned items
            </div>
          ) : (
            items.map((i) => {
              const key = `${i.kind}:${i.id}`;
              const focused = key === focusKey;
              return (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3",
                    focused && "border-biolum/40 ring-1 ring-biolum/30"
                  )}
                  key={key}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setFocus(key)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-biolum text-xs">
                        {i.kind}
                      </span>
                      {focused ? (
                        <span className="rounded bg-biolum/10 px-2 py-0.5 text-biolum text-xs">
                          focus
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-biolum text-sm">
                      {i.label ?? i.id}
                    </div>
                    <div className="mt-1 truncate text-biolum-dim text-xs">
                      {i.id}
                    </div>
                  </button>
                  <Button
                    className="ml-2"
                    onClick={() => removeItem(i.kind, i.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function WorkingSetAppWindow(props: WindowComponentProps) {
  return <WorkingSetApp {...props} className="h-full" />;
}
