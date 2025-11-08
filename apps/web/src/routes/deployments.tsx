import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import PromoteDialog from "@/components/deploy/promote-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getToolToken } from "@/lib/token";
import { trpc } from "@/utils/trpc";

const DEFAULT_DOMAIN_FALLBACK = "alfred.local";

function slugifyApp(app: string) {
  return app
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  const normalized = value.replace(/_/g, " ");
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getHealthKey(app: string, type: string) {
  return `${app}:${type}`;
}

function suggestProdHost(app: string) {
  const slug = slugifyApp(app);
  if (typeof window === "undefined") {
    return `${slug}.${DEFAULT_DOMAIN_FALLBACK}`;
  }
  const domain =
    import.meta.env?.VITE_APP_DOMAIN ??
    (window.location.hostname.length > 0
      ? window.location.hostname
      : DEFAULT_DOMAIN_FALLBACK);
  return `${slug}.${domain}`;
}

export const Route = createFileRoute("/deployments")({
  component: DeploymentsRoute,
});

function DeploymentsRoute() {
  const utils = trpc.useUtils();
  const [promoteState, setPromoteState] = useState<{
    app: string;
    host?: string;
  } | null>(null);
  const [liveHealth, setLiveHealth] = useState(false);
  const [healthStatusMap, setHealthStatusMap] = useState<
    Record<
      string,
      {
        status: "healthy" | "unhealthy" | "unknown";
        url: string | null;
        ts: string;
      }
    >
  >({});
  const readTokenRef = useRef<string | null>(null);
  const listQuery = trpc.deploy.list.useQuery(useMemo(() => ({}), []));
  const promoteMutation = trpc.deploy.promote.useMutation({
    onSuccess: async () => {
      await utils.deploy.list.invalidate();
      toast.success("Deployment promoted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to promote deployment");
    },
  });
  const removeMutation = trpc.deploy.remove.useMutation({
    onSuccess: async () => {
      await utils.deploy.list.invalidate();
      toast.success("Deployment removed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove deployment");
    },
  });

  useEffect(() => {
    if (!liveHealth) {
      readTokenRef.current = null;
      return;
    }
    let cancelled = false;
    if (readTokenRef.current) return;
    (async () => {
      try {
        const token = await getToolToken(["deploy.read"], "read");
        if (!cancelled) {
          readTokenRef.current = token;
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to start live health";
          toast.error(message);
          setLiveHealth(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveHealth]);

  const deployments = listQuery.data ?? [];

  useEffect(() => {
    if (deployments.length === 0) return;
    setHealthStatusMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const deployment of deployments) {
        const key = getHealthKey(deployment.app, deployment.type);
        if (!next[key] && deployment.healthStatus) {
          next[key] = {
            status:
              (deployment.healthStatus as
                | "healthy"
                | "unhealthy"
                | "unknown") ?? "unknown",
            url: (deployment.healthUrl as string | null) ?? null,
            ts: deployment.lastHealthCheck
              ? new Date(deployment.lastHealthCheck).toISOString()
              : new Date(deployment.updated ?? new Date()).toISOString(),
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [deployments]);

  const isLoading = listQuery.isLoading;
  const subscribedApps = useMemo(() => {
    const unique = new Set<string>();
    for (const deployment of deployments) {
      unique.add(deployment.app);
    }
    return Array.from(unique);
  }, [deployments]);

  trpc.deploy.healthStream.useSubscription(
    {
      apps: subscribedApps.length > 0 ? subscribedApps : undefined,
      intervalMs: 5000,
      authz: readTokenRef.current
        ? `Bearer ${readTokenRef.current}`
        : undefined,
    },
    {
      enabled: liveHealth && Boolean(readTokenRef.current),
      onData: (event) => {
        setHealthStatusMap((prev) => ({
          ...prev,
          [getHealthKey(event.app, event.type)]: {
            status: event.status,
            url: event.url,
            ts: event.ts,
          },
        }));
      },
      onError: (error) => {
        toast.error(error.message || "Health stream error");
        setLiveHealth(false);
        readTokenRef.current = null;
      },
    }
  );

  async function handleRemove(app: string, preview: boolean) {
    if (
      !window.confirm(
        `Remove the ${preview ? "preview" : "production"} deployment for ${app}?`
      )
    ) {
      return;
    }
    try {
      const token = await getToolToken(["deploy.write", "router.write"], "low");
      await removeMutation.mutateAsync({
        app,
        preview,
        authz: `Bearer ${token}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to remove deployment";
      toast.error(message);
    }
  }

  async function handleCopy(url: string | null) {
    if (!url) {
      toast.error("Deployment has no URL yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied to clipboard");
    } catch {
      toast.error("Failed to copy URL");
    }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Deployments</CardTitle>
          <CardDescription>
            Preview and production deployments created by Alfred.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">
              Loading deployments…
            </p>
          ) : deployments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No deployments yet. Use the orchestrator or API to provision a
              preview build.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Button
                  onClick={() => setLiveHealth((current) => !current)}
                  size="sm"
                  variant={liveHealth ? "default" : "outline"}
                >
                  {liveHealth ? "Disable Live Health" : "Enable Live Health"}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-border text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">App</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">State</th>
                      <th className="px-3 py-2 font-medium">Health</th>
                      <th className="px-3 py-2 font-medium">Host</th>
                      <th className="px-3 py-2 font-medium">Updated</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployments.map((deployment) => {
                      const stateLabel = formatLabel(deployment.status);
                      const key = getHealthKey(deployment.app, deployment.type);
                      const liveEntry = healthStatusMap[key];
                      const derivedStatus = (liveEntry?.status ??
                        (deployment.healthStatus as
                          | "healthy"
                          | "unhealthy"
                          | "unknown"
                          | null) ??
                        "unknown") as "healthy" | "unhealthy" | "unknown";
                      const healthLabel = formatLabel(derivedStatus);
                      const healthClass =
                        derivedStatus === "healthy"
                          ? "text-emerald-600"
                          : derivedStatus === "unhealthy"
                            ? "text-destructive"
                            : "text-muted-foreground";
                      const healthTimestamp =
                        liveEntry?.ts ??
                        (deployment.lastHealthCheck
                          ? new Date(deployment.lastHealthCheck).toISOString()
                          : null);
                      return (
                        <tr
                          className="border-border border-t"
                          key={deployment.id}
                        >
                          <td className="px-3 py-2">{deployment.app}</td>
                          <td className="px-3 py-2 capitalize">
                            {deployment.type}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-foreground">
                              {stateLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className={`font-medium ${healthClass}`}>
                                {healthLabel}
                              </span>
                              {healthTimestamp ? (
                                <span className="text-muted-foreground text-xs">
                                  {new Date(
                                    healthTimestamp
                                  ).toLocaleTimeString()}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {deployment.url ? (
                              <button
                                className="text-primary underline-offset-2 hover:underline"
                                onClick={() => handleCopy(deployment.url)}
                                type="button"
                              >
                                {deployment.domain || deployment.url}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {deployment.updated
                              ? new Date(deployment.updated).toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              {deployment.type === "preview" ? (
                                <Button
                                  disabled={promoteMutation.isPending}
                                  onClick={() =>
                                    setPromoteState({
                                      app: deployment.app,
                                      host: suggestProdHost(deployment.app),
                                    })
                                  }
                                  size="sm"
                                  variant="secondary"
                                >
                                  {promoteMutation.isPending
                                    ? "Promoting…"
                                    : "Promote"}
                                </Button>
                              ) : null}
                              <Button
                                disabled={removeMutation.isPending}
                                onClick={() =>
                                  handleRemove(
                                    deployment.app,
                                    deployment.type === "preview"
                                  )
                                }
                                size="sm"
                                variant="outline"
                              >
                                {removeMutation.isPending
                                  ? "Removing…"
                                  : "Remove"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <PromoteDialog
        app={promoteState?.app ?? ""}
        defaultHost={promoteState?.host}
        isSubmitting={promoteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPromoteState(null);
          }
        }}
        onSubmit={async ({ upstream, host }) => {
          if (!promoteState) return;
          try {
            const token = await getToolToken(
              ["deploy.write", "router.write"],
              "low"
            );
            await promoteMutation.mutateAsync({
              app: promoteState.app,
              upstream,
              host,
              authz: `Bearer ${token}`,
            });
            setPromoteState(null);
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Unable to promote deployment";
            toast.error(message);
          }
        }}
        open={promoteState !== null}
      />
    </div>
  );
}
