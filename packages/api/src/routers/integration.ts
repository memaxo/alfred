/**
 * Integration Router - External service connections
 *
 * Provides endpoints for managing integration statuses and connections.
 */

import { z } from "zod";
import { probeTailscaleStatus, type TailscaleProbe } from "../tailscale/status";
import { authedProcedure, router } from "../trpc";

type IntegrationStatus = {
  id: string;
  name: string;
  enabled: boolean;
  connected: boolean;
  lastCheck?: string;
  error?: string;
  details?: {
    installed?: boolean;
    running?: boolean;
    tailnet?: string;
    dnsName?: string;
    hostName?: string;
  };
};

export const integrationRouter = router({
  // List all integration statuses
  list: authedProcedure.query(async (): Promise<IntegrationStatus[]> => {
    const now = new Date().toISOString();
    const tailscale: TailscaleProbe = await probeTailscaleStatus().catch(
      () =>
        ({
          ok: false,
          installed: false,
          error: "tailscale_probe_failed",
        }) satisfies TailscaleProbe
    );

    const tailscaleEnabled =
      // "Connectivity" integration: enabled if tailscale exists on the host.
      tailscale.installed === true ||
      // "Automation" integration: enabled if API key is present (future work).
      !!process.env.TAILSCALE_API_KEY;

    const tailscaleConnected =
      tailscale.ok && "running" in tailscale ? tailscale.running : false;

    const tailscaleError = (() => {
      if (tailscale.ok) {
        return;
      }
      return tailscale.error;
    })();

    const tailscaleDetails = (() => {
      if (tailscale.ok) {
        return {
          installed: true,
          running: tailscale.running,
          tailnet: tailscale.tailnet,
          dnsName: tailscale.self?.dnsName,
          hostName: tailscale.self?.hostName,
        };
      }
      if (tailscale.installed) {
        return { installed: true };
      }
      return { installed: false };
    })();

    return [
      {
        id: "linear",
        name: "Linear",
        enabled: !!process.env.LINEAR_CLIENT_ID,
        connected: !!process.env.LINEAR_CLIENT_ID,
        lastCheck: now,
      },
      {
        id: "homeassistant",
        name: "Home Assistant",
        enabled: !!process.env.HOME_BASE_URL,
        connected: false, // Would need to actually test connection
        lastCheck: now,
      },
      {
        id: "tailscale",
        name: "Tailscale",
        enabled: tailscaleEnabled,
        connected: tailscaleConnected,
        lastCheck: now,
        error: tailscaleError,
        details: tailscaleDetails,
      },
    ];
  }),

  // Test connection to an integration
  testConnection: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => {
      // TODO: Implement actual connection testing
      return {
        success: false,
        message: "Connection testing not yet implemented",
      };
    }),
});
