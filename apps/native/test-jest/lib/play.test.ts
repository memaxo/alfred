import { Audio } from "expo-av";
import { deleteAsync, writeAsStringAsync } from "expo-file-system";

import { playBase64 } from "@/lib/voice/play";

describe(playBase64, () => {
  it("resolves promptly on AbortSignal abort", async () => {
    const stopAsync = jest.fn().mockImplementation(async () => {});
    const unloadAsync = jest.fn().mockImplementation(async () => {});
    const playAsync = jest.fn().mockImplementation(async () => {});
    const setOnPlaybackStatusUpdate = jest.fn();

    jest.mocked(Audio.Sound.createAsync).mockResolvedValue({
      sound: {
        playAsync,
        stopAsync,
        unloadAsync,
        setOnPlaybackStatusUpdate,
      } as unknown,
    } as unknown as Awaited<ReturnType<typeof Audio.Sound.createAsync>>);
    jest.mocked(writeAsStringAsync).mockImplementation(async () => {});
    jest.mocked(deleteAsync).mockImplementation(async () => {});

    const controller = new AbortController();
    const p = playBase64("AA==", "audio/wav", { signal: controller.signal });

    // Ensure playback has started before aborting.
    for (let i = 0; i < 10; i += 1) {
      if (playAsync.mock.calls.length > 0) {
        break;
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(playAsync).toHaveBeenCalledWith();
    controller.abort();

    await p;

    expect(stopAsync).toHaveBeenCalledWith();
    expect(unloadAsync).toHaveBeenCalledWith();
    expect(deleteAsync).toHaveBeenCalledWith();
  });
});
