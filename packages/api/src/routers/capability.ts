import { capabilities } from "@alfred/agent/capability";

import { authedProcedure, router } from "../trpc";

export const capabilityRouter = router({
  list: authedProcedure.query(() => capabilities),
});
