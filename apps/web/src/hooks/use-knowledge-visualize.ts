import { useCallback, useState } from "react";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

export function useKnowledgeVisualize() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawnKnowledgeGraph = useDesktopStore((s) => s.spawnKnowledgeGraph);
  const windows = useDesktopStore((s) => s.windows);
  const viewport = useDesktopStore((s) => s.viewport);

  const visualizeMutation = trpc.knowledge.visualize.useMutation();

  const visualize = useCallback(
    async (
      text: string,
      options?: {
        resource?: string;
        limit?: number;
        center?: { x: number; y: number };
      }
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await visualizeMutation.mutateAsync({
          text,
          resource: options?.resource,
          limit: options?.limit ?? 20,
        });

        if (!result.nodes || result.nodes.length === 0) {
          setError("No knowledge nodes found");
          return [];
        }

        const center = options?.center ?? {
          x: -viewport.x + 600,
          y: -viewport.y + 400,
        };

        const windowIds = spawnKnowledgeGraph(
          result.nodes,
          result.edges ?? [],
          center
        );

        return windowIds;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [visualizeMutation, spawnKnowledgeGraph, viewport]
  );

  const visualizeFromWindow = useCallback(
    (windowId: string) => {
      const window = windows.find((w) => w.id === windowId);
      if (!window) {
        setError("Window not found");
        return [];
      }

      // Extract text content from window data
      const data = window.data as Record<string, unknown>;
      let text = "";

      if (typeof data.label === "string") {
        text = data.label;
      }
      if (typeof data.content === "string") {
        text = text ? `${text}\n${data.content}` : data.content;
      }
      if (typeof data.summary === "string") {
        text = text ? `${text}\n${data.summary}` : data.summary;
      }
      if (typeof data.description === "string") {
        text = text ? `${text}\n${data.description}` : data.description;
      }

      if (!text.trim()) {
        setError("No text content to visualize");
        return [];
      }

      // Position the graph near the source window
      const center = {
        x: window.position.x + 400,
        y: window.position.y,
      };

      return visualize(text, { center });
    },
    [windows, visualize]
  );

  return {
    visualize,
    visualizeFromWindow,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
