import { compressionWorkerOverrides } from "@alfred/agent/orchestrator/config";
import { startCompressionWorker } from "@alfred/agent/orchestrator/compression-worker";

const compressionConfig = compressionWorkerOverrides();
if (compressionConfig.enabled) {
  startCompressionWorker(compressionConfig);
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
