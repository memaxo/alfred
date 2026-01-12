/**
 * Component Detail Route
 *
 * Renders the selected manifest component and links to its external source.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ComponentDemo } from "@/components/demo";
import {
  type ComponentName,
  componentRegistry,
  componentStatus,
} from "@/components/manifest";
import { RouteError } from "@/components/route-error";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_protected/components/$name")({
  component: ComponentRoute,
  errorComponent: RouteError,
});

function ComponentRoute() {
  const { name } = Route.useParams();

  const componentName = useMemo(() => {
    const key = name as ComponentName;
    return Object.prototype.hasOwnProperty.call(componentRegistry, key)
      ? key
      : null;
  }, [name]);

  if (!componentName) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-10">
        <h1 className="font-semibold text-2xl text-biolum">
          Unknown component
        </h1>
        <p className="text-biolum-dim text-sm">
          <code>{name}</code> is not present in the component manifest.
        </p>
        <Link className="text-biolum hover:underline" to="/components">
          ← Back to components
        </Link>
      </div>
    );
  }

  const status = componentStatus[componentName];
  const source = componentRegistry[componentName];
  const href = `https://${source}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between gap-6">
        <div className="space-y-1">
          <Link
            className="text-biolum-dim text-sm hover:underline"
            to="/components"
          >
            ← Components
          </Link>
          <h1 className="font-mono text-3xl text-biolum">{componentName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-biolum-dim text-sm hover:text-biolum"
            href={href}
            rel="noreferrer"
            target="_blank"
          >
            Source
          </a>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs uppercase tracking-wide",
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
      </div>

      <div className="rounded-2xl border border-white/10 bg-void-surface/40 p-4">
        <ComponentDemo name={componentName} />
      </div>
    </div>
  );
}
