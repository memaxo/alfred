/**
 * Docs placeholder route
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/$")({
  component: DocsPlaceholder,
});

function DocsPlaceholder() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
      <h1 className="mb-4 font-bold text-2xl">Documentation Coming Soon</h1>
      <p className="text-muted-foreground">
        The documentation system (fumadocs) is not fully configured yet.
      </p>
      <p className="mt-2 text-muted-foreground text-sm">
        Missing: source.config.ts and collection setup
      </p>
    </div>
  );
}
