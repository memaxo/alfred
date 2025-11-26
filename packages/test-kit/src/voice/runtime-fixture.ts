import { vi } from "bun:test";
import type { STTPool } from "@alfred/voice/process/stt";
import type { TTSPool } from "@alfred/voice/process/tts";
import { createVoiceTestRegistry } from "./registry";
export { createVoiceTestRegistry, createVoiceFixture } from "./registry";
import type { VoiceTestOptions } from "./registry";

export async function installVoiceTestPools(options?: VoiceTestOptions) {
  const poolsModule = await import("@alfred/api/voice/pools");
  const { registry, sttPool, ttsPool } = createVoiceTestRegistry(options);
  const typedStt = sttPool as unknown as STTPool;
  const typedTts = ttsPool as unknown as TTSPool;

  const getVoicePoolsSpy = vi
    .spyOn(poolsModule, "getVoicePools")
    .mockReturnValue({
      sttPool: typedStt,
      ttsPool: typedTts,
      voiceRegistry: registry,
    });

  const initSpy = vi
    .spyOn(poolsModule, "initializeVoicePools")
    .mockResolvedValue();
  const shutdownSpy = vi
    .spyOn(poolsModule, "shutdownVoicePools")
    .mockResolvedValue();

  return {
    registry,
    sttPool: typedStt,
    ttsPool: typedTts,
    restore() {
      getVoicePoolsSpy.mockRestore();
      initSpy.mockRestore();
      shutdownSpy.mockRestore();
      registry.shutdown();
    },
  };
}
