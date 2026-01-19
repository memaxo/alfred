/**
 * Integrations Settings Section
 *
 * External service connections: Linear, Home Assistant, Tailscale.
 */

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";

function tailscaleHint(integration: {
  enabled: boolean;
  connected: boolean;
  error?: string;
  details?: { installed?: boolean; running?: boolean };
}): string | null {
  if (integration.connected) {
    return null;
  }
  if (integration.details?.installed === false) {
    return "Tailscale not installed on server.";
  }
  if (
    integration.details?.installed === true &&
    integration.details.running === false
  ) {
    return "Tailscale installed but not running (start `tailscaled`).";
  }
  switch (integration.error) {
    case "tailscale_not_found":
      return "Tailscale CLI not found in PATH.";
    case "tailscale_version_timeout":
      return "Tailscale check timed out.";
    case "tailscale_status_timeout":
      return "Tailscale status timed out.";
    case "tailscale_status_parse_failed":
      return "Tailscale status output was not valid JSON.";
    case "tailscale_status_failed":
      return "Tailscale status command failed.";
    default:
      return null;
  }
}

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
                {integration.enabled ? (
                  <>
                    Configured
                    {integration.lastCheck ? (
                      <span className="text-biolum-dim">
                        {" "}
                        · checked{" "}
                        {new Date(integration.lastCheck).toLocaleString()}
                      </span>
                    ) : null}
                  </>
                ) : (
                  "Not configured"
                )}
              </div>
              {integration.id === "tailscale" ? (
                <div className="mt-1 text-biolum-dim text-xs">
                  {tailscaleHint(integration) ? (
                    <div className="mb-1 text-amber-200">
                      {tailscaleHint(integration)}
                    </div>
                  ) : null}
                  {integration.details ? (
                    <div className="mb-1 text-biolum-dim">
                      {integration.details.installed === true
                        ? "Installed"
                        : "Not installed"}
                      {typeof integration.details.running === "boolean"
                        ? integration.details.running
                          ? " · running"
                          : " · not running"
                        : null}
                      {integration.details.tailnet
                        ? ` · ${integration.details.tailnet}`
                        : null}
                      {integration.details.dnsName
                        ? ` · ${integration.details.dnsName}`
                        : null}
                    </div>
                  ) : null}
                  <a
                    className="underline decoration-white/20 underline-offset-4 hover:decoration-white/40"
                    href="https://github.com/jackmazac/alfred/blob/dev/docs/guides/tailscale-connectivity.md"
                    rel="noopener"
                    target="_blank"
                  >
                    Connectivity guide
                  </a>
                  {integration.error ? (
                    <span className="text-red-300"> · {integration.error}</span>
                  ) : null}
                </div>
              ) : null}
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
