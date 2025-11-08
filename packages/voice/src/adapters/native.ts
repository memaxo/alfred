import type { PlatformAdapter } from "../session";

interface RecordingInstance {
  prepareToRecordAsync(options: unknown): Promise<void>;
  startAsync(): Promise<void>;
  stopAndUnloadAsync(): Promise<void>;
  getURI(): string | null;
}

interface NativeFileSystem {
  readAsStringAsync(
    uri: string,
    options: { encoding: "base64" }
  ): Promise<string>;
  writeAsStringAsync(
    uri: string,
    data: string,
    options: { encoding: "base64" }
  ): Promise<void>;
  deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void>;
  cacheDirectory?: string | null;
  documentDirectory?: string | null;
}

interface NativeAudioModule {
  setAudioModeAsync(options: Record<string, unknown>): Promise<void>;
  Sound: {
    createAsync(
      source: { uri: string } | { arrayBuffer: ArrayBuffer },
      status?: Record<string, unknown>,
      onPlaybackStatusUpdate?: (status: unknown) => void
    ): Promise<{
      sound: { playAsync(): Promise<void>; unloadAsync(): Promise<void> };
    }>;
  };
  RecordingOptionsPresets?: Record<string, unknown>;
}

export interface NativeDeps {
  Audio: NativeAudioModule;
  Recording: new () => RecordingInstance;
  FileSystem: NativeFileSystem;
  recordingOptions?: unknown;
}

const DEFAULT_OPTIONS_KEY = "HIGH_QUALITY";

function resolveDirectory(fs: NativeFileSystem): string {
  return fs.cacheDirectory ?? fs.documentDirectory ?? "";
}

function extensionForMime(mime: string): string {
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/opus") return "opus";
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/webm") return "webm";
  return "m4a";
}

export function createNativeAdapter(deps: NativeDeps): PlatformAdapter {
  let recording: RecordingInstance | null = null;
  let lastConfig: { mode: string; background: boolean } | null = null;

  async function configureSession(opts: {
    mode: string;
    background?: boolean;
  }): Promise<void> {
    const background = Boolean(opts.background);
    if (
      lastConfig &&
      lastConfig.mode === opts.mode &&
      lastConfig.background === background
    ) {
      return;
    }
    if (typeof deps.Audio.setAudioModeAsync === "function") {
      await deps.Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: background,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
      });
    }
    lastConfig = { mode: opts.mode, background };
  }

  async function startCapture(): Promise<void> {
    if (recording) {
      return;
    }
    const instance = new deps.Recording();
    const options =
      deps.recordingOptions ??
      deps.Audio.RecordingOptionsPresets?.[DEFAULT_OPTIONS_KEY] ??
      null;
    if (options) {
      await instance.prepareToRecordAsync(options);
    } else {
      await instance.prepareToRecordAsync({});
    }
    await instance.startAsync();
    recording = instance;
  }

  async function stopCapture(): Promise<{
    mimeType: string;
    audioBase64: string;
  } | null> {
    if (!recording) {
      return null;
    }
    const active = recording;
    recording = null;
    await active.stopAndUnloadAsync();
    const uri = active.getURI();
    if (!uri) {
      return null;
    }
    const audioBase64 = await deps.FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });
    return { mimeType: "audio/m4a", audioBase64 };
  }

  async function play(base64: string, mimeType: string): Promise<void> {
    const dir = resolveDirectory(deps.FileSystem);
    const filename = `${dir || ""}voice-${Date.now()}.${extensionForMime(mimeType)}`;
    await deps.FileSystem.writeAsStringAsync(filename, base64, {
      encoding: "base64",
    });
    try {
      const { sound } = await deps.Audio.Sound.createAsync({ uri: filename });
      await sound.playAsync();
      await sound.unloadAsync();
    } finally {
      await deps.FileSystem.deleteAsync(filename, { idempotent: true });
    }
  }

  return {
    configureSession,
    startCapture,
    stopCapture,
    play,
  };
}
