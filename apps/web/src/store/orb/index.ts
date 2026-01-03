/**
 * Orb Store - AI presence indicator state management
 *
 * Manages the Orb's mode, state, position, and animation parameters.
 *
 * @see docs/execplans/desktop-evolution-prd.md Part IV (OrbStore)
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type OrbMode = "docked" | "floating" | "expanded" | "hidden";
export type OrbState = "idle" | "listening" | "thinking" | "talking" | "active";

export type OrbPosition = {
  x: number;
  y: number;
};

export type OrbStore = {
  // Presence state
  mode: OrbMode;
  state: OrbState;
  position: OrbPosition;

  // Animation state
  intensity: number;
  pulseRate: number;
  colorShift: number;

  // Voice overlay
  isVoiceOverlayVisible: boolean;
  voiceWaveform: number[];

  // Mode control
  setMode: (mode: OrbMode) => void;
  dock: () => void;
  float: () => void;
  expand: () => void;
  hide: () => void;

  // Position control
  setPosition: (position: OrbPosition) => void;

  // State transitions
  setIdle: () => void;
  setListening: () => void;
  setThinking: () => void;
  setTalking: () => void;
  setActive: () => void;

  // Animation control
  setIntensity: (intensity: number) => void;
  setPulseRate: (rate: number) => void;
  setColorShift: (shift: number) => void;

  // Voice overlay
  showVoiceOverlay: () => void;
  hideVoiceOverlay: () => void;
  setVoiceWaveform: (waveform: number[]) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE PRESETS
// ─────────────────────────────────────────────────────────────────────────────

const statePresets: Record<
  OrbState,
  { intensity: number; pulseRate: number; colorShift: number }
> = {
  idle: { intensity: 0.3, pulseRate: 0.5, colorShift: 0 },
  listening: { intensity: 0.7, pulseRate: 1.2, colorShift: 0.2 },
  thinking: { intensity: 0.8, pulseRate: 2.0, colorShift: 0.5 },
  talking: { intensity: 0.9, pulseRate: 1.5, colorShift: 0.3 },
  active: { intensity: 1.0, pulseRate: 2.5, colorShift: 0.8 },
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useOrbStore = create<OrbStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        mode: "docked",
        state: "idle",
        position: { x: 0, y: 0 },
        intensity: 0.3,
        pulseRate: 0.5,
        colorShift: 0,
        isVoiceOverlayVisible: false,
        voiceWaveform: [],

        // Mode control
        setMode: (mode) => set({ mode }),
        dock: () => set({ mode: "docked" }),
        float: () => set({ mode: "floating" }),
        expand: () => set({ mode: "expanded", isVoiceOverlayVisible: true }),
        hide: () => set({ mode: "hidden" }),

        // Position control
        setPosition: (position) => set({ position }),

        // State transitions with animation presets
        setIdle: () => set({ state: "idle", ...statePresets.idle }),
        setListening: () =>
          set({ state: "listening", ...statePresets.listening }),
        setThinking: () => set({ state: "thinking", ...statePresets.thinking }),
        setTalking: () => set({ state: "talking", ...statePresets.talking }),
        setActive: () => set({ state: "active", ...statePresets.active }),

        // Animation control
        setIntensity: (intensity) => set({ intensity }),
        setPulseRate: (pulseRate) => set({ pulseRate }),
        setColorShift: (colorShift) => set({ colorShift }),

        // Voice overlay
        showVoiceOverlay: () => set({ isVoiceOverlayVisible: true }),
        hideVoiceOverlay: () => set({ isVoiceOverlayVisible: false }),
        setVoiceWaveform: (voiceWaveform) => set({ voiceWaveform }),
      }),
      {
        name: "alfred-orb",
        partialize: (state) => ({
          mode: state.mode,
          position: state.position,
        }),
      }
    ),
    { name: "OrbStore" }
  )
);
