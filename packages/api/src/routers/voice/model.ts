import { authedProcedure } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import { voiceDownloadInput } from "./schema";

export const voiceListAvailableModelsProcedure = authedProcedure.query(
  async () => {
    const { listAvailableModels } = await import(
      "@alfred/voice/services/models"
    );
    return listAvailableModels();
  }
);

export const voiceDownloadModelProcedure = authedProcedure
  .input(voiceDownloadInput)
  .mutation(async ({ input }) => {
    try {
      const { downloadModel } = await import("@alfred/voice/services/models");
      return await downloadModel(input.voiceId);
    } catch (error) {
      throw toTRPCError(error, "voice_download_failed");
    }
  });

export const voiceListVoicesProcedure = authedProcedure.query(async () => {
  const { listVoices } = await import("@alfred/voice/services/models");
  return listVoices();
});
