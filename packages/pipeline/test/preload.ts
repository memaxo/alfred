import { logger } from "@alfred/logger";

// Tests intentionally exercise failure paths (missing AgentFS workspace, missing sqlite tables, etc).
// Those should not spam structured logs on stdout/stderr. Keep assertions behavioral.
logger.configure({
  transport: {
    write() {
      // no-op
    },
  },
});
