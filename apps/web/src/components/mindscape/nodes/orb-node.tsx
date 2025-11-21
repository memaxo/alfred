import { Handle, type NodeProps, Position } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";
import { Orb } from "@/components/ui/orb";
import { useVoiceVisualizerStore } from "@/store/voice-visualizer";
import { useLOD } from "../lod";

export const OrbNode = memo((_props: NodeProps) => {
  const lod = useLOD();
  const analyser = useVoiceVisualizerStore((state) => state.analyser);
  const streamStatus = useVoiceVisualizerStore((state) => state.streamStatus);
  const setVadLevel = useVoiceVisualizerStore((state) => state.setVadLevel);
  const frameRef = useRef<number>(0);

  // Map stream status to Orb agentState
  const agentState = (() => {
    switch (streamStatus) {
      case "recording":
        return "listening";
      case "processing":
        return "thinking";
      case "playing":
        return "speaking";
      case "connecting":
        return "thinking"; // or a specific state if Orb supports it
      default:
        return "idle";
    }
  })();

  useEffect(() => {
    if (!analyser) {
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      // Calculate average energy for VAD level
      let sum = 0;
      const len = dataArray.length;
      for (let i = 0; i < len; i++) {
        sum += dataArray[i] ?? 0;
      }
      const avg = sum / len;
      // Normalize 0-255 to 0-1 approximately, maybe clamp/scale
      const normalized = Math.min(1, avg / 50); // 50 is arbitrary sensitivity
      setVadLevel(normalized);

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [analyser, setVadLevel]);

  // LOD Tiny/Small: Just a small glowing dot
  if (lod === "tiny" || lod === "small") {
    return (
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full">
        <div
          className={`h-4 w-4 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] ${agentState !== "idle" ? "animate-pulse" : ""}`}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-[400px] w-[400px] items-center justify-center rounded-full">
      <div className="absolute inset-0">
        <Orb
          agentState={agentState}
          className="h-full w-full" // White/Purple flare
          colors={["#FFFFFF", "#A855F7"]} // Default state for now
        />
      </div>

      {/* Handles for connections */}
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Top}
        type="source"
      />
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Right}
        type="source"
      />
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Bottom}
        type="source"
      />
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Left}
        type="source"
      />
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Top}
        type="target"
      />
    </div>
  );
});

OrbNode.displayName = "OrbNode";
