import { startCompressionWorker } from "@alfred/agent/orchestrator/compression-worker";

const compressionEnv =
  process.env.COMPRESSION_ENABLED === undefined
    ? "auto"
    : process.env.COMPRESSION_ENABLED;

if (compressionEnv !== "false") {
  startCompressionWorker({
    enabled:
      compressionEnv === "true" || process.env.NODE_ENV === "production",
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
