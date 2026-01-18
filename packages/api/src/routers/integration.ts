/**
 * Integration Router - External service connections
 *
 * Provides endpoints for managing integration statuses and connections.
 */

import { z } from "zod";
import { authedProcedure, router } from "../trpc";

type IntegrationStatus = {
  id: string;
  name: string;
  enabled: boolean;
  connected: boolean;
  lastCheck?: string;
  error?: string;
};

export const integrationRouter = router({
  // List all integration statuses
  list: authedProcedure.query(async (): Promise<IntegrationStatus[]> => {
    // TODO: Implement actual status checks
    return [
      {
        id: "linear",
        name: "Linear",
        enabled: !!process.env.LINEAR_CLIENT_ID,
        connected: !!process.env.LINEAR_CLIENT_ID,
      },
      {
        id: "homeassistant",
        name: "Home Assistant",
        enabled: !!process.env.HOME_BASE_URL,
        connected: false, // Would need to actually test connection
      },
      {
        id: "tailscale",
        name: "Tailscale",
        enabled: !!process.env.TAILSCALE_API_KEY,
        connected: false,
      },
    ];
  }),

  // Test connection to an integration
  testConnection: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async () => {
      // TODO: Implement actual connection testing
      return {
        success: false,
        message: "Connection testing not yet implemented",
      };
    }),
});
