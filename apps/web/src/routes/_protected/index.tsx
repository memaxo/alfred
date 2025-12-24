import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { ClientOnly } from "@/components/ai-elements/client-only";
import { Desktop } from "@/components/desktop/desktop";
import {
  useDesktopDeeplinks,
  type DesktopSearchParams,
} from "@/hooks/use-desktop-deeplinks";
import { useKnowledgeVisualize } from "@/hooks/use-knowledge-visualize";
import { useDesktopStore } from "@/store/desktop";

const searchSchema = z.object({
  windowId: z.string().optional(),
  spawn: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

export const Route = createFileRoute("/_protected/")({
  ssr: false, // Uses ReactFlow - browser-only
  component: DesktopRoute,
  validateSearch: (search) => searchSchema.parse(search),
});

function DesktopRoute() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_protected/" }) as DesktopSearchParams;
  const { visualizeFromWindow } = useKnowledgeVisualize();
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);
  const focusWindow = useDesktopStore((s) => s.focusWindow);

  // Process deep link params
  useDesktopDeeplinks(search);

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
