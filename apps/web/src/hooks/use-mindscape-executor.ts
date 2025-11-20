import { useMindscapeStore } from "@/store/mindscape";
import { useCallback } from "react";
import { nanoid } from "nanoid";

export function useMindscapeExecutor() {
  const addArtifact = useMindscapeStore((state) => state.addArtifact);

  const startWorkflow = useCallback((requirement: string) => {
    const id = nanoid();
    addArtifact({
      id,
      type: "workflow",
      position: { x: 100, y: 100 }, // Should use layout engine later
      data: {
        label: "Workflow Run",
        requirement,
        status: "pending",
        auto: "low",
        tasks: [],
      },
    });
    return id;
  }, [addArtifact]);

  return { startWorkflow };
}

