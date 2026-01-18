/**
 * Integrations Settings Section
 *
 * External service connections: Linear, Home Assistant, Tailscale.
 */

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";

export function IntegrationsSection() {
  const { data: integrations, isLoading } = trpc.integration.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-biolum" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="font-semibold text-lg">Integrations</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          External service connections: Linear, Home Assistant, Tailscale.
        </p>
      </div>

      <div className="space-y-3">
        {integrations?.map((integration) => (
          <div
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
            key={integration.id}
          >
            <div>
              <div className="font-medium">{integration.name}</div>
              <div className="text-biolum-dim text-sm">
                {integration.enabled
                  ? "Configured via environment"
                  : "Not configured"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {integration.connected ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
              <span className="text-sm">
                {integration.connected ? "Connected" : "Not connected"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-biolum-dim text-xs">
        Integration credentials are managed via environment variables. See
        config/env.example for details.
      </p>
    </div>
  );
}
