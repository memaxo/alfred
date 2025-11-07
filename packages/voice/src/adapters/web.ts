import type { PlatformAdapter } from "../session";

export function createWebAdapter(): PlatformAdapter {
	let recorder: any = null;
	let chunks: any[] = [];

	async function startCapture(): Promise<void> {
		if (recorder) {
			return;
		}
		const mediaDevices = (globalThis.navigator as any)?.mediaDevices;
		if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
			throw new Error("mediaDevices API unavailable");
		}
		const stream = await mediaDevices.getUserMedia({ audio: true });
		const MediaRecorderCtor = (globalThis as any).MediaRecorder;
		if (typeof MediaRecorderCtor !== "function") {
			throw new Error("MediaRecorder unavailable");
		}
		const mediaRecorder = new MediaRecorderCtor(stream);
		chunks = [];
		mediaRecorder.ondataavailable = (event: any) => {
			if (event.data && event.data.size > 0) {
				chunks.push(event.data);
			}
		};
		mediaRecorder.start();
		recorder = mediaRecorder;
	}

	function stopCapture(): Promise<{ mimeType: string; audioBase64: string } | null> {
		if (!recorder) {
			return Promise.resolve(null);
		}
		const activeRecorder = recorder;
		recorder = null;
		return new Promise((resolve, reject) => {
			activeRecorder.onstop = () => {
				const BlobCtor = (globalThis as any).Blob;
				const FileReaderCtor = (globalThis as any).FileReader;
				if (typeof BlobCtor !== "function" || typeof FileReaderCtor !== "function") {
					resolve(null);
					return;
				}
				const blob = new BlobCtor(chunks, {
					type: activeRecorder.mimeType || "audio/webm",
				});
				const reader = new FileReaderCtor();
				reader.onloadend = () => {
					const result = reader.result;
					if (typeof result !== "string") {
						resolve(null);
						return;
					}
					const base64 = result.split(",")[1] ?? "";
					resolve({ mimeType: blob.type || "audio/webm", audioBase64: base64 });
				};
				reader.onerror = () => {
					reject(reader.error ?? new Error("Failed to read audio blob"));
				};
				reader.readAsDataURL(blob);
				activeRecorder.stream.getTracks().forEach((track: any) => track.stop());
				chunks = [];
			};
			activeRecorder.onerror = () => {
				activeRecorder.stream.getTracks().forEach((track: any) => track.stop());
				chunks = [];
				resolve(null);
			};
			activeRecorder.stop();
		});
	}

	async function play(base64: string, mimeType: string): Promise<void> {
		const AudioCtor = (globalThis as any).Audio;
		if (typeof AudioCtor !== "function") {
			return;
		}
		const uri = `data:${mimeType};base64,${base64}`;
		const audio = new AudioCtor(uri);
		await audio.play();
	}

	return {
		startCapture,
		stopCapture,
		play,
	};
}
