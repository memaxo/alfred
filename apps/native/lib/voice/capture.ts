import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { configureAudioSession } from "./config";

const MIME_TYPE = "audio/m4a";

export class ExpoCapture {
	private recording: Audio.Recording | null = null;

	async start(): Promise<void> {
		if (this.recording) {
			return;
		}
		await configureAudioSession(Audio, { background: true });
		const instance = new Audio.Recording();
		const options = Audio.RecordingOptionsPresets?.HIGH_QUALITY;
		if (!options) {
			throw new Error("expo-av recording presets unavailable");
		}
		await instance.prepareToRecordAsync(options);
		await instance.startAsync();
		this.recording = instance;
	}

	async stop(): Promise<{ mimeType: string; audioBase64: string } | null> {
		if (!this.recording) {
			return null;
		}
		const active = this.recording;
		this.recording = null;
		await active.stopAndUnloadAsync();
		const uri = active.getURI();
		if (!uri) {
			return null;
		}
		try {
			const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
			return { mimeType: MIME_TYPE, audioBase64 };
		} finally {
			await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
		}
	}
}
