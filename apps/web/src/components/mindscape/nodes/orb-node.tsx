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
  // AgentState is null | "thinking" | "listening" | "talking"
  const agentState: null | "thinking" | "listening" | "talking" = (() => {
    switch (streamStatus) {
      case "recording":
        return "listening";
      case "processing":
        return "thinking";
      case "playing":
        return "talking";
      case "connecting":
        return "thinking";
      default:
        return null;
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

  // Shared handles for all LOD levels
  const handles = (
    <>
      <Handle
        className="border-none! bg-transparent!"
        position={Position.Top}
        type="source"
      />
      <Handle
        className="border-none! bg-transparent!"
        position={Position.Right}
        type="source"
      />
      <Handle
        className="border-none! bg-transparent!"
        position={Position.Bottom}
        type="source"
      />
      <Handle
        className="border-none! bg-transparent!"
        position={Position.Left}
        type="source"
      />
      <Handle
        className="border-none! bg-transparent!"
        position={Position.Top}
        type="target"
      />
    </>
  );

  // LOD Tiny: Minimal glowing dot
  if (lod === "tiny") {
    return (
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div
          className={`h-6 w-6 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.9)] ${agentState !== null ? "animate-pulse" : ""}`}
        />
        {handles}
      </div>
    );
  }

  // LOD Small: Larger glowing orb with ring
  if (lod === "small") {
    return (
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div
          className={`h-16 w-16 rounded-full border border-white/60 bg-black shadow-[0_0_30px_rgba(255,255,255,0.6),inset_0_0_20px_rgba(168,85,247,0.3)] ${agentState !== null ? "animate-pulse" : ""}`}
        />
        {handles}
      </div>
    );
  }

  // LOD Medium: CSS-only orb with glow effects (lighter than Three.js)
  if (lod === "medium") {
    return (
      <div className="relative flex h-[200px] w-[200px] items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Outer glow */}
          <div
            className="absolute h-[180px] w-[180px] rounded-full blur-xl"
            style={{
              background:
                "radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)",
            }}
          />
          {/* Core void */}
          <div
            className={`relative h-[120px] w-[120px] rounded-full border-2 border-white/70 bg-black shadow-[0_0_60px_rgba(168,85,247,0.4),0_0_100px_rgba(255,255,255,0.2)] ${agentState !== null ? "animate-pulse" : ""}`}
          />
        </div>
        {handles}
      </div>
    );
  }

  // LOD Full: Three.js Orb with all effects
  return (
    <div className="relative flex h-[400px] w-[400px] items-center justify-center rounded-full">
      <div className="absolute inset-0">
        <Orb
          agentState={agentState}
          className="h-full w-full"
          colors={["#FFFFFF", "#A855F7"]}
        />
      </div>
      {handles}
    </div>
  );
});

OrbNode.displayName = "OrbNode";
