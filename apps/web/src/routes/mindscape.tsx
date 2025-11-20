import { createFileRoute } from "@tanstack/react-router";
import { MindscapeCanvas } from "@/components/mindscape/canvas";
import { ClientOnly } from "@/components/ai-elements/client-only";

export const Route = createFileRoute("/mindscape")({
  component: MindscapeRoute,
});

function MindscapeRoute() {
  return (
    <ClientOnly>
      <MindscapeCanvas />
    </ClientOnly>
  );
}

