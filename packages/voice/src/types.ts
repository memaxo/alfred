export type VoiceMode = "clip" | "stream";

export interface SttRequest {
	audioBase64: string;
	mimeType: string;
	language?: string;
	model?: string;
}

export interface SttResult {
	text: string;
	language?: string | null;
	model: string;
	provider: string;
	durationSeconds: number;
}

export interface TtsRequest {
	text: string;
	voice?: string;
	format?: "mp3" | "opus" | "wav";
	model?: string;
}

export interface TtsResult {
	audioBase64: string;
	mimeType: string;
	model: string;
	provider: string;
	durationSeconds: number;
}

export type CaptureState = "idle" | "recording" | "flushing";

export interface VoiceSessionState {
	capture: CaptureState;
	processing: boolean;
	transcript: string;
	error?: string | null;
}
