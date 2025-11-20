import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MindscapeCanvas } from "@/components/mindscape/canvas";
import { ClientOnly } from "@/components/ai-elements/client-only";
import { mindscapeSpawnTypes } from "@/components/mindscape/spawn";

const mindscapeSearchSchema = z.object({
  nodeId: z.string().optional(),
  spawn: z.enum(mindscapeSpawnTypes).optional(),
  open: z.string().optional(),
});

export const Route = createFileRoute("/mindscape")({
  component: MindscapeRoute,
  validateSearch: mindscapeSearchSchema,
});

function MindscapeRoute() {
  const search = Route.useSearch();
  return (
    <ClientOnly>
      <MindscapeCanvas searchParams={search} />
    </ClientOnly>
  );
}
