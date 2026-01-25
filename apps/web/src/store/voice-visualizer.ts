import { create } from "zustand";

export interface VoiceVisualizerState {
  analyser: AnalyserNode | null;
  vadLevel: number;
  streamStatus:
    | "idle"
    | "connecting"
    | "recording"
    | "processing"
    | "playing"
    | "error";
  setAnalyser: (analyser: AnalyserNode | null) => void;
  setVadLevel: (level: number) => void;
  setStreamStatus: (status: VoiceVisualizerState["streamStatus"]) => void;
}

export const useVoiceVisualizerStore = create<VoiceVisualizerState>((set) => ({
  analyser: null,
  vadLevel: 0,
  streamStatus: "idle",
  setAnalyser: (analyser) => set({ analyser }),
  setVadLevel: (vadLevel) => set({ vadLevel }),
  setStreamStatus: (streamStatus) => set({ streamStatus }),
}));
