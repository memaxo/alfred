// Auto-initialize API services when module is imported (backward compatibility)
import { initApiServices } from "./init";

initApiServices();

// Export internal utilities needed by runtime
export { generateText } from "./ai/generate";
export { prepareModelMessagesForGenerate } from "./ai/messages";
export { initApiServices, shutdownApiServices } from "./init";
export type { AppRouter } from "./routers/index";
export { appRouter } from "./routers/index";
export {
  authedProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  t,
} from "./trpc";
export { sanitizeResult } from "./utils/generate";
export {
  assertDbAvailable,
  assertUvAvailable,
  isDbAvailable,
  isDbConnectionError,
  isTransientError,
  isUvAvailable,
  resetDbAvailability,
} from "./utils/service-availability";
