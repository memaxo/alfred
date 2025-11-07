import { useMemo } from "react";
import { Audio } from "expo-av";
import type { VoiceSession, PlatformAdapter } from "@alfred/voice/session";
import { createVoiceSession } from "@alfred/voice/session";
import { createVoiceClient } from "@alfred/voice/transport";
import type { SttRequest } from "@alfred/voice/types";
import { markVoice } from "@alfred/metrics/performance";
import type { VoiceClient } from "@alfred/voice/transport";
import { ExpoCapture } from "./capture";
import { playBase64 } from "./play";
import { configureAudioSession } from "./config";

interface MutationAdapter {
	mutation<TInput, TOutput>(path: string, input: TInput): Promise<TOutput>;
}

function resolveMutation(rawClient: unknown, path: string, input: unknown): Promise<unknown> {
	const anyClient = rawClient as Record<string, unknown> & {
		mutation?: (nextPath: string, nextInput: unknown) => Promise<unknown>;
	};
	if (typeof anyClient?.mutation === "function") {
		return anyClient.mutation(path, input);
	}
	const segments = path.split(".");
	let cursor: any = rawClient;
	for (const segment of segments) {
		if (cursor && typeof cursor === "object" && segment in cursor) {
			cursor = cursor[segment];
		} else {
			cursor = null;
			break;
		}
	}
	if (cursor && typeof cursor.mutate === "function") {
		return cursor.mutate(input);
	}
	throw new Error(`tRPC client missing mutation handler for ${path}`);
}

function toMutationAdapter(trpc: unknown): MutationAdapter {
	return {
		mutation: <TInput, TOutput>(path: string, input: TInput) =>
			resolveMutation(trpc, path, input) as Promise<TOutput>,
	};
}

function createNativePlatformAdapter(): PlatformAdapter {
	const capture = new ExpoCapture();
	return {
		configureSession: ({ background }) => configureAudioSession(Audio, { background }),
		startCapture: () => capture.start(),
		stopCapture: () => capture.stop(),
		play: (base64, mimeType) => playBase64(base64, mimeType),
	};
}

function createSession(client: VoiceClient): VoiceSession {
	const adapter = createNativePlatformAdapter();
	return createVoiceSession(adapter, client);
}

export function useVoiceSessionNative(trpc: unknown) {
	return useMemo(() => {
		const mutationAdapter = toMutationAdapter(trpc);
		const client = createVoiceClient({ trpc: mutationAdapter });
		const session = createSession(client);

		const start = async () => {
			markVoice("fast_capture_start");
			await session.start();
		};

		const stopAndTranscribe = async (opts?: Partial<SttRequest>) => {
			const result = await session.stopAndTranscribe(opts);
			markVoice("fast_stream_flush");
			return result;
		};

		return {
			state: session.state,
			start,
			stopAndTranscribe,
			speak: session.speak,
			clear: session.clear,
		};
	}, [trpc]);
}
