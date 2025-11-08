type AudioModule = typeof import("expo-av").Audio;

let lastAppliedBackground: boolean | null = null;

export async function configureAudioSession(
  Audio: AudioModule,
  opts?: { background?: boolean }
): Promise<void> {
  const background = Boolean(opts?.background);
  if (typeof Audio.setAudioModeAsync !== "function") {
    return;
  }
  if (lastAppliedBackground !== null && lastAppliedBackground === background) {
    return;
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: background,
    interruptionModeIOS: 1,
    shouldDuckAndroid: true,
  });
  lastAppliedBackground = background;
}
