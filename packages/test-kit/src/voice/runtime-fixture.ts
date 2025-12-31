import { vi } from "bun:test";
import { createVoiceTestRegistry } from "./registry";

export { createVoiceFixture, createVoiceTestRegistry } from "./registry";

import type { VoiceTestOptions } from "./registry";

export async function installVoiceTestPools(options?: VoiceTestOptions) {
  const poolsModule = await import("@alfred/api/voice/pools");
  const { registry, sttPool, ttsPool } = createVoiceTestRegistry(options);
  // Use the return type from getVoicePools to ensure type compatibility
  type VoicePools = ReturnType<typeof poolsModule.getVoicePools>;
  const typedStt = sttPool as unknown as VoicePools["sttPool"];
  const typedTts = ttsPool as unknown as VoicePools["ttsPool"];
  const typedRegistry = registry as unknown as VoicePools["voiceRegistry"];

  const getVoicePoolsSpy = vi
    .spyOn(poolsModule, "getVoicePools")
    .mockReturnValue({
      sttPool: typedStt,
      ttsPool: typedTts,
      voiceRegistry: typedRegistry,
      sessionManager: typedRegistry,
    });

  const initSpy = vi
    .spyOn(poolsModule, "initializeVoicePools")
    .mockResolvedValue(undefined);
  const shutdownSpy = vi
    .spyOn(poolsModule, "shutdownVoicePools")
    .mockResolvedValue(undefined);

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
