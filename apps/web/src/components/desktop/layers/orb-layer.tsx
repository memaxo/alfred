"use client";

/**
 * Orb Layer - Floating voice orb with visual feedback
 *
 * Renders the orb component with voice state integration and drag handling.
 * Positioned at z: 900 above windows, below overlays.
 *
 * Features:
 * - Visual states: idle (pulse), listening (expand), recording (glow), processing (spin)
 * - Quick actions: voice trigger, window spawn shortcuts
 * - Draggable with persistent position
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 4.4
 */

import { useEffect } from "react";
import { Orb } from "@/components/orb/index";
import { useVoiceSessionWeb } from "@/hooks/use-voice-session-web";
import { useOrbStore } from "@/store/orb";
import { LayerErrorBoundary } from "../error-boundary";

type OrbLayerProps = {
  style?: React.CSSProperties;
};

export function OrbLayer({ style }: OrbLayerProps) {
  const { stream } = useVoiceSessionWeb();
  const setListening = useOrbStore((s) => s.setListening);
  const setThinking = useOrbStore((s) => s.setThinking);
  const setIdle = useOrbStore((s) => s.setIdle);

  useEffect(() => {
    if (
      stream.status === "idle" ||
      stream.status === "connecting" ||
      stream.status === "error"
    ) {
      setIdle();
    } else if (stream.status === "recording") {
      setListening();
    } else if (stream.status === "processing") {
      setThinking();
    } else if (stream.status === "playing") {
      setThinking();
    }
  }, [stream.status, setListening, setThinking, setIdle]);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-layer="orb"
      style={style}
    >
      <LayerErrorBoundary fallback={null} layerName="Voice Orb">
        <div className="pointer-events-auto">
          <Orb />
        </div>
      </LayerErrorBoundary>
    </div>
  );
}
