/**
 * Voice Store - Voice session state management
 *
 * Manages voice sessions, audio devices, STT/TTS state, and configuration.
 *
 * @see docs/execplans/desktop-evolution-prd.md Part IV (VoiceStore)
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type VoiceMode = "push-to-talk" | "voice-activity" | "continuous";

export type AudioDevice = {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput";
};

export type VoiceStore = {
  // Session state
  sessionId: string | null;
  isActive: boolean;
  mode: VoiceMode;

  // Audio state
  inputDevice: AudioDevice | null;
  outputDevice: AudioDevice | null;
  availableInputDevices: AudioDevice[];
  availableOutputDevices: AudioDevice[];
  inputLevel: number;
  outputLevel: number;

  // STT state
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;

  // TTS state
  isSpeaking: boolean;
  currentUtterance: string;
  utteranceQueue: string[];

  // Configuration
  voiceModel: string;
  sttModel: string;
  ttsVoice: string;
  vadSensitivity: number;

  // Session control
  startSession: () => void;
  endSession: () => void;
  setMode: (mode: VoiceMode) => void;

  // Device control
  setInputDevice: (device: AudioDevice) => void;
  setOutputDevice: (device: AudioDevice) => void;
  setAvailableDevices: (input: AudioDevice[], output: AudioDevice[]) => void;
  setInputLevel: (level: number) => void;
  setOutputLevel: (level: number) => void;

  // STT control
  startListening: () => void;
  stopListening: () => void;
  setTranscript: (transcript: string) => void;
  setInterimTranscript: (transcript: string) => void;
  setConfidence: (confidence: number) => void;
  clearTranscript: () => void;

  // TTS control
  speak: (text: string) => void;
  stopSpeaking: () => void;
  queueUtterance: (text: string) => void;
  clearQueue: () => void;

  // Configuration
  setVoiceModel: (model: string) => void;
  setSttModel: (model: string) => void;
  setTtsVoice: (voice: string) => void;
  setVadSensitivity: (sensitivity: number) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useVoiceStore = create<VoiceStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        sessionId: null,
        isActive: false,
        mode: "voice-activity",

        inputDevice: null,
        outputDevice: null,
        availableInputDevices: [],
        availableOutputDevices: [],
        inputLevel: 0,
        outputLevel: 0,

        isListening: false,
        transcript: "",
        interimTranscript: "",
        confidence: 0,

        isSpeaking: false,
        currentUtterance: "",
        utteranceQueue: [],

        voiceModel: "claude-3-opus",
        sttModel: "whisper-large-v3",
        ttsVoice: "alloy",
        vadSensitivity: 0.5,

        // Session control
        startSession: () =>
          set({
            sessionId: crypto.randomUUID(),
            isActive: true,
          }),
        endSession: () =>
          set({
            sessionId: null,
            isActive: false,
            isListening: false,
            isSpeaking: false,
            transcript: "",
            interimTranscript: "",
          }),
        setMode: (mode) => set({ mode }),

        // Device control
        setInputDevice: (device) => set({ inputDevice: device }),
        setOutputDevice: (device) => set({ outputDevice: device }),
        setAvailableDevices: (input, output) =>
          set({
            availableInputDevices: input,
            availableOutputDevices: output,
          }),
        setInputLevel: (level) => set({ inputLevel: level }),
        setOutputLevel: (level) => set({ outputLevel: level }),

        // STT control
        startListening: () => set({ isListening: true }),
        stopListening: () => set({ isListening: false }),
        setTranscript: (transcript) => set({ transcript }),
        setInterimTranscript: (transcript) =>
          set({ interimTranscript: transcript }),
        setConfidence: (confidence) => set({ confidence }),
        clearTranscript: () =>
          set({ transcript: "", interimTranscript: "", confidence: 0 }),

        // TTS control
        speak: (text) => set({ isSpeaking: true, currentUtterance: text }),
        stopSpeaking: () => set({ isSpeaking: false, currentUtterance: "" }),
        queueUtterance: (text) =>
          set((state) => ({
            utteranceQueue: [...state.utteranceQueue, text],
          })),
        clearQueue: () => set({ utteranceQueue: [] }),

        // Configuration
        setVoiceModel: (model) => set({ voiceModel: model }),
        setSttModel: (model) => set({ sttModel: model }),
        setTtsVoice: (voice) => set({ ttsVoice: voice }),
        setVadSensitivity: (sensitivity) =>
          set({ vadSensitivity: sensitivity }),
      }),
      {
        name: "alfred-voice",
        partialize: (state) => ({
          mode: state.mode,
          inputDevice: state.inputDevice,
          outputDevice: state.outputDevice,
          voiceModel: state.voiceModel,
          sttModel: state.sttModel,
          ttsVoice: state.ttsVoice,
          vadSensitivity: state.vadSensitivity,
        }),
      }
    ),
    { name: "VoiceStore" }
  )
);
