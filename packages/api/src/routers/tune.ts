import { parseFineTuneConfig, runFineTuneJob } from "@alfred/tune";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

const startInput = z.object({
  config: z.unknown(),
  pythonBin: z.string().optional(),
  runsRoot: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const tuneRouter = router({
  start: authedProcedure.input(startInput).mutation(async ({ input }) => {
    const config = parseFineTuneConfig(input.config);
    const result = await runFineTuneJob(config, {
      workspaceRoot: process.cwd(),
      runsRoot: input.runsRoot,
      pythonBin: input.pythonBin,
      env: input.env,
    });

    return {
      runId: result.runId,
      status: result.status,
      artifacts: result.artifacts,
      summary: result.summary,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    };
  }),
});
