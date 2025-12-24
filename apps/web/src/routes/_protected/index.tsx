import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@/components/ai-elements/client-only";
import { Desktop } from "@/components/desktop/desktop";
import { useKnowledgeVisualize } from "@/hooks/use-knowledge-visualize";
import { useDesktopStore } from "@/store/desktop";

export const Route = createFileRoute("/_protected/")({
  ssr: false, // Uses ReactFlow - browser-only
  component: DesktopRoute,
});

function DesktopRoute() {
  const navigate = useNavigate();
  const { visualizeFromWindow } = useKnowledgeVisualize();
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);
  const focusWindow = useDesktopStore((s) => s.focusWindow);

  const handleVisualize = async (windowId: string) => {
    await visualizeFromWindow(windowId);
  };

  const handleAsk = (_windowId: string, _label?: string) => {
    // Spawn or focus chat window and pre-fill with context
    const chatId = spawnWindow("chat");
    focusWindow(chatId);
  };

  return (
    <ClientOnly>
      <Desktop
        onAsk={handleAsk}
        onVisualize={handleVisualize}
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
