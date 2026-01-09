import { getMetricsJSON } from "../metrics";
import { protectedProcedure, router } from "../trpc";

export const metricsRouter = router({
  getSnapshot: protectedProcedure.query(async () => await getMetricsJSON()),
});
