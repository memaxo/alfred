"use client";

import { Layers, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

function riskBadge(risk: string) {
  if (risk === "high") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  if (risk === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

export function CapabilityApp({ window: _window }: WindowComponentProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = trpc.capability.list.useQuery();
  const list = data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((c) => {
      const haystack =
        `${c.id} ${c.title} ${c.category} ${c.summary}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [list, query]);

  const active = useMemo(() => {
    if (selected) {
      return list.find((c) => String(c.id) === selected) ?? null;
    }
    return list[0] ?? null;
  }, [list, selected]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-void-surface">
        <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-void" data-app="capability">
      <div className="w-80 border-white/5 border-r">
        <div className="flex h-10 items-center gap-2 border-white/5 border-b px-3">
          <Layers className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Capabilities</span>
        </div>
        <div className="p-3">
          <Input
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            value={query}
          />
        </div>
        <ScrollArea className="h-[calc(100%-40px-72px)]">
          <div className="space-y-1 p-2">
            {filtered.map((c) => {
              const id = String(c.id);
              const isActive = id === (selected ?? String(active?.id ?? ""));
              return (
                <button
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                    isActive
                      ? "bg-biolum/15 text-biolum"
                      : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
                  )}
                  key={id}
                  onClick={() => setSelected(id)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono">{id}</div>
                    <div className="truncate text-[11px] text-biolum-dim">
                      {c.title}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                      riskBadge(c.risk)
                    )}
                  >
                    {c.risk}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-10 items-center justify-between border-white/5 border-b bg-void-surface px-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-biolum text-sm">
              {active ? String(active.id) : "capability"}
            </span>
            {active && (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                  riskBadge(active.risk)
                )}
              >
                {active.risk}
              </span>
            )}
          </div>
          {active && (
            <span className="text-biolum-dim text-xs">{active.category}</span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {active ? (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-void-surface/40 p-4">
              <div className="text-biolum text-sm">{active.title}</div>
              <div className="text-biolum-dim text-sm">{active.summary}</div>
              <div className="flex flex-wrap gap-2 pt-2">
                {active.requiresAuth && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-biolum-dim">
                    auth
                  </span>
                )}
                {active.requiresElevation && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-biolum-dim">
                    elevation
                  </span>
                )}
                {active.uiOnly && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-biolum-dim">
                    ui-only
                  </span>
                )}
                {active.webWindowType && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-biolum-dim">
                    window:{active.webWindowType}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-biolum-dim">No capabilities.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CapabilityAppWindow(props: WindowComponentProps) {
  return <CapabilityApp {...props} />;
}

export default CapabilityApp;
