import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ClientOnly } from "@/components/ai-elements/client-only";
import { MindscapeCanvas } from "@/components/mindscape/canvas";
import { mindscapeSpawnTypes } from "@/components/mindscape/spawn";
import { getInitialMindscapeFrame } from "@/lib/mindscape/initial-frame.server";

const mindscapeSearchSchema = z.object({
  nodeId: z.string().optional(),
  spawn: z.enum(mindscapeSpawnTypes).optional(),
  open: z.string().optional(),
  ragDoc: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_protected/mindscape")({
  component: MindscapeRoute,
  validateSearch: mindscapeSearchSchema,
  loader: () => getInitialMindscapeFrame(),
});

function MindscapeRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <ClientOnly>
      <MindscapeCanvas
        onRagDocNavigate={(documentId) =>
          navigate({
            to: "/mindscape",
            search: (prev) => ({
              ...prev,
              ragDoc: documentId,
            }),
          })
        }
        onWorkflowNavigate={(runId) =>
          navigate({
            to: "/workflow/$runId",
            params: { runId },
            search: () => ({ drawer: "1" }),
          })
        }
        searchParams={search}
      />
    </ClientOnly>
  );
}
