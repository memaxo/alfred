import type { NodeProps } from "@xyflow/react";
import { Activity, ServerCog, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import PromoteDialog from "@/components/deploy/promote-dialog";
import { BiolumBadge } from "@/components/tremor";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { withObligationRetry } from "@/lib/obligation-retry";
import { getToolToken } from "@/lib/token";
import { type ArtifactData, useMindscapeStore } from "@/store/mindscape";
import { deploymentNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { useLOD, useNodeFocus } from "../lod";
import { MindscapeNode } from "./mindscape-node";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

const DEFAULT_DOMAIN_FALLBACK = "alfred.local";

type HealthEntry = {
  status: "healthy" | "unhealthy" | "unknown";
  url: string | null;
  ts: string;
};

function slugify(app: string) {
  return app
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function suggestProdHost(app: string) {
  if (typeof window === "undefined") {
    return `${slugify(app)}.${DEFAULT_DOMAIN_FALLBACK}`;
  }
  const domain =
    import.meta.env?.VITE_APP_DOMAIN ??
    (window.location.hostname.length > 0
      ? window.location.hostname
      : DEFAULT_DOMAIN_FALLBACK);
  return `${slugify(app)}.${domain}`;
}

function getHealthKey(app: string, type: string) {
  return `${app}:${type}`;
}

function formatTimestamp(value?: Date | string | null) {
  if (!value) {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

export function DeploymentNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  const parsed = deploymentNodeDataSchema.safeParse(data);
  const [promoteState, setPromoteState] = useState<{
    app: string;
    host?: string;
  } | null>(null);
  const [liveHealth, setLiveHealth] = useState(
    Boolean(parsed.success ? parsed.data.liveHealth : false)
  );
  const [healthStatusMap, setHealthStatusMap] = useState<
    Record<string, HealthEntry>
  >({});
  const readTokenRef = useRef<string | null>(null);

  const utils = trpc.useUtils();
  const deploymentsQuery = trpc.deploy.list.useQuery({});
  const deployments = deploymentsQuery.data ?? [];

  const promoteMutation = trpc.deploy.promote.useMutation({
    onSuccess: async () => {
      toast.success("Deployment promoted");
      await utils.deploy.list.invalidate();
    },
    onError: (error) =>
      toast.error(error.message ?? "Failed to promote deployment"),
  });

  const removeMutation = trpc.deploy.remove.useMutation({
    onSuccess: async () => {
      toast.success("Deployment removed");
      await utils.deploy.list.invalidate();
    },
    onError: (error) =>
      toast.error(error.message ?? "Failed to remove deployment"),
  });

  const { updateArtifactData } = useMindscapeStore((state) => ({
    updateArtifactData: state.updateArtifactData,
  }));

  useEffect(() => {
    updateArtifactData(id, { liveHealth } as Partial<ArtifactData>);
  }, [id, liveHealth, updateArtifactData]);

  useEffect(() => {
    if (!liveHealth) {
      readTokenRef.current = null;
      return;
    }
    let cancelled = false;
    if (readTokenRef.current) {
      return;
    }
    (async () => {
      try {
        const token = await getToolToken(["deploy.read"], "read");
        if (!cancelled) {
          readTokenRef.current = token;
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to enable health"
          );
          setLiveHealth(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveHealth]);

  useEffect(() => {
    if (deployments.length === 0) {
      return;
    }
    setHealthStatusMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const deployment of deployments) {
        const key = getHealthKey(deployment.app, deployment.type);
        if (!next[key] && deployment.healthStatus) {
          next[key] = {
            status:
              (deployment.healthStatus as HealthEntry["status"]) ?? "unknown",
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
        toast.error(error.message ?? "Health stream error");
        setLiveHealth(false);
        readTokenRef.current = null;
      },
    }
  );

  const groupedDeployments = useMemo(() => {
    const groups: Record<string, typeof deployments> = {};
    for (const deployment of deployments) {
      const appKey = deployment.app;
      if (!groups[appKey]) {
        groups[appKey] = [];
      }
      groups[appKey].push(deployment);
    }
    return Object.entries(groups);
  }, [deployments]);

  const handleCopy = async (url: string | null) => {
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
  };

  const handleRemove = async (app: string, preview: boolean) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Remove the ${preview ? "preview" : "production"} deployment for ${app}?`
      )
    ) {
      return;
    }
    try {
      const token = await getToolToken(["deploy.write", "router.write"], "low");
      await withObligationRetry(() =>
        removeMutation.mutateAsync({
          app,
          preview,
          authz: `Bearer ${token}`,
        })
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to remove deployment";
      toast.error(message);
    }
  };

  const healthClassName = (status: HealthEntry["status"]) => {
    switch (status) {
      case "healthy":
        return "text-emerald-300";
      case "unhealthy":
        return "text-red-400";
      default:
        return "text-biolum-faint";
    }
  };

  // LOD 0: Tiny
  if (lod === "tiny") {
    return <NodeLODTiny color="bg-white" shadow="shadow-white/80" />;
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor="border-white/10"
        hoverColor="hover:border-white/20"
        icon={<ServerCog className="h-3 w-3" />}
        label="Deployments"
        textColor="text-white"
      />
    );
  }

  return (
    <>
      <MindscapeNode
        className="w-[440px] border-white/10 bg-void-surface/30"
        headerActions={<ServerCog className="h-4 w-4 text-biolum" />}
        id={id}
        selected={selected}
        title="Deployments"
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-biolum-faint">
              {deployments.length} records
            </span>
            <Button
              className="gap-2"
              onClick={() => setLiveHealth((prev) => !prev)}
              size="sm"
              variant={liveHealth ? "secondary" : "outline"}
            >
              <Activity className="h-4 w-4" />{" "}
              {liveHealth ? "Disable" : "Live Health"}
            </Button>
          </div>
          <ScrollArea className="h-[260px] rounded-lg border border-white/5">
            {deploymentsQuery.isLoading ? (
              <p className="p-4 text-center text-biolum-faint text-sm">
                Loading deployments…
              </p>
            ) : deployments.length === 0 ? (
              <p className="p-4 text-center text-biolum-faint text-sm">
                No deployments yet. Use the orchestrator to publish a preview
                build.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {groupedDeployments.map(([app, entries]) => (
                  <div className="space-y-3 p-4" key={app}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-biolum text-sm">
                          {app}
                        </p>
                        <p className="text-biolum-faint text-xs">
                          Updated {formatTimestamp(entries[0]?.updated ?? null)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            setPromoteState({
                              app,
                              host: suggestProdHost(app),
                            })
                          }
                          size="sm"
                          variant="secondary"
                        >
                          Promote
                        </Button>
                        <Button
                          onClick={() => handleRemove(app, true)}
                          size="sm"
                          variant="ghost"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {entries.map((deployment) => {
                        const key = getHealthKey(
                          deployment.app,
                          deployment.type
                        );
                        const liveEntry = healthStatusMap[key];
                        const status =
                          liveEntry?.status ??
                          (deployment.healthStatus as HealthEntry["status"]) ??
                          "unknown";
                        return (
                          <div
                            className="rounded-lg border border-white/5 bg-void-surface/20 p-3"
                            key={deployment.id}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex flex-col">
                                <span className="text-biolum capitalize">
                                  {deployment.type}
                                </span>
                                <span
                                  className={`text-xs ${healthClassName(status)}`}
                                >
                                  {status}
                                </span>
                              </div>
                              <BiolumBadge>
                                {deployment.status?.replace(/_/g, " ") ??
                                  "queued"}
                              </BiolumBadge>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-biolum-faint text-xs">
                              <span>
                                {deployment.domain ||
                                  deployment.url ||
                                  "Pending host"}
                              </span>
                              {liveEntry?.ts && (
                                <span>
                                  •{" "}
                                  {new Date(liveEntry.ts).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <Button
                                className="gap-2"
                                onClick={() =>
                                  handleCopy(
                                    liveEntry?.url ?? deployment.url ?? null
                                  )
                                }
                                size="sm"
                                variant="outline"
                              >
                                <Share2 className="h-3.5 w-3.5" /> Copy URL
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </MindscapeNode>

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
          if (!promoteState) {
            return;
          }
          try {
            const token = await getToolToken(
              ["deploy.write", "router.write"],
              "low"
            );
            await withObligationRetry(() =>
              promoteMutation.mutateAsync({
                app: promoteState.app,
                upstream,
                host,
                authz: `Bearer ${token}`,
              })
            );
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
    </>
  );
}
