import { describe, expect, it } from "bun:test";

import { probeTailscaleStatus } from "../src/tailscale/status";

const shouldRun = process.env.ALFRED_TEST_TAILSCALE === "1";

describe("tailscale (e2e)", () => {
  (shouldRun ? it : it.skip)(
    "probes host tailscale status via CLI",
    async () => {
      const res = await probeTailscaleStatus({ timeoutMs: 2000 });
      expect(res.installed).toBe(true);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(typeof res.running).toBe("boolean");
      }
    }
  );
});
