import type { VoiceClient } from "./transport/trpc";
import type {
	CaptureState,
	SttRequest,
	SttResult,
	TtsRequest,
	VoiceMode,
	VoiceSessionState,
} from "./types";

export interface PlatformAdapter {
	startCapture(): Promise<void>;
	stopCapture(): Promise<{ mimeType: string; audioBase64: string } | null>;
	play(base64: string, mimeType: string): Promise<void>;
	configureSession?(opts: { mode: VoiceMode; background?: boolean }): Promise<void>;
}

export interface VoiceSession {
	state: VoiceSessionState;
	start(): Promise<void>;
	stopAndTranscribe(opts?: Partial<SttRequest>): Promise<SttResult | null>;
	speak(opts: TtsRequest): Promise<void>;
	clear(): void;
}

const IDLE: CaptureState = "idle";

export function createVoiceSession(adapter: PlatformAdapter, client: VoiceClient): VoiceSession {
	const state: VoiceSessionState = {
		capture: IDLE,
		processing: false,
		transcript: "",
		error: null,
	};

	async function start(): Promise<void> {
		if (state.capture === "recording") {
			return;
		}
		state.error = null;
		if (adapter.configureSession) {
			await adapter.configureSession({ mode: "clip", background: true });
		}
		await adapter.startCapture();
		state.capture = "recording";
	}

	async function stopAndTranscribe(opts?: Partial<SttRequest>): Promise<SttResult | null> {
		if (state.capture !== "recording") {
			return null;
		}
		state.capture = "flushing";
		const payload = await adapter.stopCapture();
		state.capture = IDLE;
		if (!payload) {
			return null;
		}

		const request: SttRequest = {
			audioBase64: payload.audioBase64,
			mimeType: payload.mimeType,
			language: opts?.language,
			model: opts?.model,
		};

		state.processing = true;
		try {
			const result = await client.stt(request);
			state.transcript = result.text;
			state.error = null;
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : "transcription failed";
			state.error = message;
			return null;
		} finally {
			state.processing = false;
		}
	}

	async function speak(input: TtsRequest): Promise<void> {
		state.processing = true;
		try {
			const response = await client.tts(input);
			await adapter.play(response.audioBase64, response.mimeType);
			state.error = null;
		} catch (error) {
			const message = error instanceof Error ? error.message : "synthesis failed";
			state.error = message;
		} finally {
			state.processing = false;
		}
	}

	function clear(): void {
		state.transcript = "";
		state.error = null;
	}

	return {
		state,
		start,
		stopAndTranscribe,
		speak,
		clear,
	};
}
