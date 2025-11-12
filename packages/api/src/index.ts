import { compressionWorkerOverrides } from "@alfred/agent/orchestrator/config";
import { startCompressionWorker } from "@alfred/agent/orchestrator/compression-worker";
import { initializeVoicePools } from "./voice/pools";

const compressionConfig = compressionWorkerOverrides();
if (compressionConfig.enabled) {
  startCompressionWorker(compressionConfig);
}

// Initialize voice pools if using local models
if (process.env.VOICE_PROVIDER === "local") {
  initializeVoicePools().catch((error) => {
    console.error("[voice] Failed to initialize voice pools:", error);
  });
}

export type { AppRouter } from "./routers/index";

export { appRouter } from "./routers/index";
export {
  authedProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  t,
} from "./trpc";
