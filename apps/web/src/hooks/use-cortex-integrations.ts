/**
 * Cortex Integration Hooks
 *
 * Connects cognitive state, voice FFT, and workflow runtime
 * to Cortex engine visual parameters.
 */

import type { CortexEngine, OrbState } from "@alfred/cortex";

import { useEffect, useRef } from "react";

/**
 * Cognitive state integration
 *
 * Maps cognitive state to orb visual state.
 */
export function useCognitiveStateIntegration(
  engine: CortexEngine | null,
  cognitiveState?: {
    phase?:
      | "idle"
      | "capturing"
      | "thinking"
      | "deciding"
      | "executing"
      | "reflecting";
    autonomyLevel?: number;
    physiology?: {
      energy?: number;
      frustration?: number;
      boredom?: number;
    };
  }
) {
  useEffect(() => {
    if (!(engine && cognitiveState)) {
      return;
    }

    // Map cognitive phase to orb state
    let orbState: OrbState = "idle";
    switch (cognitiveState.phase) {
      case "capturing":
        orbState = "listening";
        break;
      case "thinking":
      case "deciding":
        orbState = "processing";
        break;
      case "executing":
        orbState = "active";
        break;
      case "reflecting":
        orbState = "processing";
        break;
      default:
        orbState = "idle";
    }

    // Apply autonomy level to visual intensity
    const autonomy = cognitiveState.autonomyLevel ?? 0.5;
    const physiology = cognitiveState.physiology ?? {};
    const energy = physiology.energy ?? 0.5;

    engine.setOrbConfig({
      center: engine.getCamera().center,
      innerRadius: 150,
      outerRadius: 400,
      state: orbState,
      fiberCount: Math.floor(1500 + autonomy * 500),
      segmentsPerFiber: 50,
      rotationSpeed: Math.PI / (60 - energy * 30),
    });

    // Physiology affects visual parameters
    // High frustration = more chaotic motion
    // Low energy = slower, dimmer
    // High boredom = subtle pulsing
    // Map orbState to numeric value for shader uniforms
    const orbStateValue =
      orbState === "idle"
        ? 1
        : orbState === "listening"
          ? 2
          : orbState === "active"
            ? 3
            : 4; // processing
    engine.setUniforms({
      orbState: orbStateValue,
    });
  }, [engine, cognitiveState]);
}

/**
 * Voice FFT integration
 *
 * Connects voice input/output audio levels to visual parameters.
 */
export function useVoiceFFTIntegration(
  engine: CortexEngine | null,
  voiceState?: {
    isListening?: boolean;
    isSpeaking?: boolean;
    inputLevel?: number; // 0-1 normalized
    outputLevel?: number; // 0-1 normalized
    fft?: Float32Array; // Frequency data
  }
) {
  const prevLevelsRef = useRef({ low: 0, mid: 0 });

  useEffect(() => {
    if (!(engine && voiceState)) {
      return;
    }

    // Extract frequency bands from FFT or use raw levels
    let audioLow = 0;
    let audioMid = 0;

    if (voiceState.fft && voiceState.fft.length > 0) {
      // Low frequencies (bass): 0-250Hz
      const lowEnd = Math.floor(voiceState.fft.length * 0.1);
      for (let i = 0; i < lowEnd; i++) {
        audioLow += ((voiceState.fft[i] ?? 0) + 140) / 140; // Normalize from dB
      }
      audioLow = Math.min(1, audioLow / lowEnd);

      // Mid frequencies: 250-4000Hz
      const midStart = lowEnd;
      const midEnd = Math.floor(voiceState.fft.length * 0.5);
      for (let i = midStart; i < midEnd; i++) {
        audioMid += ((voiceState.fft[i] ?? 0) + 140) / 140;
      }
      audioMid = Math.min(1, audioMid / (midEnd - midStart));
    } else {
      // Use raw input/output levels
      const level = voiceState.isListening
        ? (voiceState.inputLevel ?? 0)
        : voiceState.isSpeaking
          ? (voiceState.outputLevel ?? 0)
          : 0;
      audioLow = level;
      audioMid = level * 0.7;
    }

    // Smooth the values
    const smoothing = 0.3;
    audioLow =
      prevLevelsRef.current.low * (1 - smoothing) + audioLow * smoothing;
    audioMid =
      prevLevelsRef.current.mid * (1 - smoothing) + audioMid * smoothing;
    prevLevelsRef.current = { low: audioLow, mid: audioMid };

    engine.setAudioLevels(audioLow, audioMid);
  }, [engine, voiceState]);
}

/**
 * Workflow runtime integration
 *
 * Connects active workflow state to edge animations and node highlighting.
 */
export function useWorkflowRuntimeIntegration(
  engine: CortexEngine | null,
  workflowState?: {
    activeRunId?: string | null;
    status?: "running" | "suspended" | "completed" | "failed" | "cancelled";
    currentTaskId?: string | null;
    progress?: number; // 0-1
    events?: Array<{
      type: string;
      nodeId?: string;
      edgeId?: string;
      timestamp: number;
    }>;
  }
) {
  useEffect(() => {
    if (!(engine && workflowState)) {
      return;
    }

    const { status, progress = 0 } = workflowState;

    // Map workflow status to visual state
    if (status === "running") {
      // Active workflow - increase visual activity
      engine.setUniforms({
        orbState: 3, // active
      });
    } else if (status === "suspended") {
      // Waiting for input - pulsing state
      engine.setUniforms({
        orbState: 2, // listening
      });
    } else {
      // Idle
      engine.setUniforms({
        orbState: 1,
      });
    }

    // Progress affects particle behavior indirectly through audio simulation
    if (status === "running" && progress > 0) {
      engine.setAudioLevels(
        Math.sin(Date.now() * 0.002) * 0.3 + 0.2, // Simulated activity
        progress * 0.5
      );
    }
  }, [engine, workflowState]);

  // Handle workflow events for edge/node activation
  useEffect(() => {
    if (!(engine && workflowState?.events)) {
      return;
    }

    // Process recent events (last 2 seconds)
    const now = Date.now();
    const recentEvents = workflowState.events.filter(
      (e) => now - e.timestamp < 2000
    );

    // Activate edges/nodes based on events
    // This would integrate with the Mindscape store to trigger edge activity
    for (const event of recentEvents) {
      if (event.edgeId) {
      }
      if (event.nodeId) {
      }
    }
  }, [engine, workflowState?.events]);
}

/**
 * Combined integration hook
 *
 * Convenience hook that combines all integrations.
 */
export function useCortexIntegrations(
  engine: CortexEngine | null,
  options: {
    cognitiveState?: Parameters<typeof useCognitiveStateIntegration>[1];
    voiceState?: Parameters<typeof useVoiceFFTIntegration>[1];
    workflowState?: Parameters<typeof useWorkflowRuntimeIntegration>[1];
  }
) {
  useCognitiveStateIntegration(engine, options.cognitiveState);
  useVoiceFFTIntegration(engine, options.voiceState);
  useWorkflowRuntimeIntegration(engine, options.workflowState);
}

/**
 * Mouse/pointer integration
 *
 * Updates engine mouse position for interactive effects.
 */
export function useMouseIntegration(engine: CortexEngine | null) {
  useEffect(() => {
    if (!engine) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      engine.setMousePosition(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [engine]);
}

/**
 * Theme integration
 *
 * Updates engine colors based on system theme.
 */
export function useThemeIntegration(
  engine: CortexEngine | null,
  theme: "dark" | "light" = "dark"
) {
  useEffect(() => {
    if (!engine) {
      return;
    }

    // Cortex is designed for dark theme
    // Light theme would require shader modifications
    if (theme === "light") {
    }
  }, [engine, theme]);
}
