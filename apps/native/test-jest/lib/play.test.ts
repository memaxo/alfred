import { Audio } from "expo-av";
import { deleteAsync, writeAsStringAsync } from "expo-file-system";

import { playBase64 } from "@/lib/voice/play";

describe("playBase64", () => {
  it("resolves promptly on AbortSignal abort", async () => {
    const stopAsync = jest.fn().mockResolvedValue(undefined);
    const unloadAsync = jest.fn().mockResolvedValue(undefined);
    const playAsync = jest.fn().mockResolvedValue(undefined);
    const setOnPlaybackStatusUpdate = jest.fn();

    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: {
        playAsync,
        stopAsync,
        unloadAsync,
        setOnPlaybackStatusUpdate,
      },
    });
    (writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
    (deleteAsync as jest.Mock).mockResolvedValue(undefined);

    const controller = new AbortController();
    const p = playBase64("AA==", "audio/wav", { signal: controller.signal });

    // Ensure playback has started before aborting.
    for (let i = 0; i < 10; i += 1) {
      if (playAsync.mock.calls.length > 0) {
        break;
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(playAsync).toHaveBeenCalled();
    controller.abort();

    await p;

    expect(stopAsync).toHaveBeenCalled();
    expect(unloadAsync).toHaveBeenCalled();
    expect(deleteAsync).toHaveBeenCalled();
  });
});
