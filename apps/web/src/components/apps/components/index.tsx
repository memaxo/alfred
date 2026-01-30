/**
 * Components App
 *
 * Desktop window that makes the manifest observable in the Desktop shell.
 * This is a wiring surface (not the definition of "integrated").
 */

import { ExternalLink, LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { ComponentDemo } from "@/components/demo";
import {
  type ComponentName,
  componentRegistry,
  componentStatus,
} from "@/components/manifest";
import { Input } from "@/components/text";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function ComponentsApp({ window: _window }: WindowComponentProps) {
  const names = useMemo(
    () => Object.keys(componentRegistry) as ComponentName[],
    []
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ComponentName>(
    names[0] ?? "connect"
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return names;
    }
    return names.filter((name) => name.toLowerCase().includes(q));
  }, [names, query]);

  const status = componentStatus[selected];
  const source = componentRegistry[selected];
  const href = `https://${source}`;

  return (
    <div className="flex h-full w-full bg-void" data-app="components">
      {/* Sidebar */}
      <div className="w-64 border-white/5 border-r">
        <div className="flex h-10 items-center gap-2 border-white/5 border-b px-3">
          <LayoutGrid className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Components</span>
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
            {filtered.map((name) => (
              <button
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left font-mono text-xs transition-colors",
                  name === selected
                    ? "bg-biolum/15 text-biolum"
                    : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
                )}
                key={name}
                onClick={() => setSelected(name)}
                type="button"
              >
                <span className="truncate">{name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                    componentStatus[name] === "integrated" &&
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
                    componentStatus[name] === "installed" &&
                      "border-amber-500/30 bg-amber-500/10 text-amber-200",
                    componentStatus[name] === "pending" &&
                      "border-white/10 bg-white/5 text-biolum-dim"
                  )}
                >
                  {componentStatus[name]}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-10 items-center justify-between border-white/5 border-b bg-void-surface px-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-biolum text-sm">{selected}</span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                status === "integrated" &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
                status === "installed" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-200",
                status === "pending" &&
                  "border-white/10 bg-white/5 text-biolum-dim"
              )}
            >
              {status}
            </span>
          </div>
          <Button asChild className="h-7 gap-1" size="sm" variant="ghost">
            <a href={href} rel="noreferrer" target="_blank">
              <ExternalLink className="h-3 w-3" />
              Source
            </a>
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="rounded-2xl border border-white/10 bg-void-surface/40 p-4">
            <ComponentDemo name={selected} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComponentsAppWindow(props: WindowComponentProps) {
  return <ComponentsApp {...props} />;
}

export default ComponentsApp;
