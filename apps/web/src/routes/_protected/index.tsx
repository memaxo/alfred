import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@/components/ai-elements/client-only";
import { Desktop } from "@/components/desktop/desktop";

export const Route = createFileRoute("/_protected/")({
  ssr: false, // Uses ReactFlow - browser-only
  component: DesktopRoute,
});

function DesktopRoute() {
  const navigate = useNavigate();
  return (
    <ClientOnly>
      <Desktop
        onWorkflowNavigate={(runId) =>
          navigate({
            to: "/workflow/$runId",
            params: { runId },
            search: () => ({ drawer: "1" as const }),
          })
        }
      />
    </ClientOnly>
  );
}
