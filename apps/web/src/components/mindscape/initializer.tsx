import { useMindscapeStore } from "@/store/mindscape";
import { useEffect } from "react";
import { nanoid } from "nanoid";

export function MindscapeInitializer() {
  const nodes = useMindscapeStore((state) => state.nodes);
  const addArtifact = useMindscapeStore((state) => state.addArtifact);
  const autoLayout = useMindscapeStore((state) => state.autoLayout);

  // Initialize with Chat Node after Orb is created
  useEffect(() => {
    // Wait for Orb to be added by Canvas
    if (nodes.length === 1 && nodes[0]?.type === "orb") {
      const chatId = nanoid();
      addArtifact({
        id: chatId,
        type: "chat",
        position: { x: 500, y: 0 },
        data: {
          label: "Neural Stream",
          messages: [],
        },
      });
      
      // Trigger layout after adding chat
      setTimeout(() => {
        autoLayout();
      }, 100);
    }
  }, [nodes, addArtifact, autoLayout]);

  return null;
}

