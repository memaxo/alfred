/**
 * Components Route
 *
 * Product surface: inspect ALFRED's component manifest in a running UI.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ComponentDemo } from "@/components/demo";
import {
  type ComponentName,
  componentRegistry,
  componentStatus,
} from "@/components/manifest";
import { RouteError } from "@/components/route-error";
import { Input } from "@/components/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_protected/components")({
  component: ComponentsRoute,
  errorComponent: RouteError,
});

function ComponentsRoute() {
  const [query, setQuery] = useState("");

  const names = useMemo(
    () => Object.keys(componentRegistry) as ComponentName[],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return names;
    }
    return names.filter((name) => name.toLowerCase().includes(q));
  }, [names, query]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="font-semibold text-3xl text-biolum">Components</h1>
          <p className="text-biolum-dim text-sm">
            Manifest-driven registry of UI building blocks.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <Input
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            value={query}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-void-surface/40">
          <div className="border-white/5 border-b px-4 py-3">
            <div className="font-medium text-biolum text-sm">Registry</div>
            <div className="text-biolum-dim text-xs">
              {filtered.length} / {names.length}
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto p-2">
            <div className="space-y-1">
              {filtered.map((name) => {
                const status = componentStatus[name];
                const source = componentRegistry[name];
                const href = `https://${source}`;

                return (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2 hover:border-white/10 hover:bg-white/5"
                    key={name}
                  >
                    <Link
                      className="min-w-0 flex-1 truncate font-mono text-biolum text-sm hover:underline"
                      params={{ name }}
                      to="/components/$name"
                    >
                      {name}
                    </Link>
                    <a
                      className="shrink-0 text-biolum-dim text-xs hover:text-biolum hover:underline"
                      href={href}
                      rel="noreferrer"
                      target="_blank"
                      title={href}
                    >
                      source
                    </a>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
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
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-void-surface/40">
          <div className="border-white/5 border-b px-4 py-3">
            <div className="font-medium text-biolum text-sm">Preview</div>
            <div className="text-biolum-dim text-xs">
              Selected: {filtered[0] ?? "—"}
            </div>
          </div>
          <div className="p-4">
            {filtered[0] ? <ComponentDemo name={filtered[0]} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
