// Auto-initialize API services when module is imported (backward compatibility)
import { initApiServices } from "./init";

initApiServices();

export type { AppRouter } from "./routers/index";

export { appRouter } from "./routers/index";
export {
  authedProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  t,
} from "./trpc";

// Export initialization functions for explicit control
export { initApiServices, shutdownApiServices } from "./init";
