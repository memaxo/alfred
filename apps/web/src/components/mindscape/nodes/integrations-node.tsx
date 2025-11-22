import type { NodeProps } from "@xyflow/react";
import { ExternalLink, Loader2, PlugZap, ShieldCheck } from "lucide-react";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { BiolumBadge } from "@/components/tremor";
import { Button } from "@/components/ui/button";
import { useMindscapeStore } from "@/store/mindscape";
import { integrationsNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { MindscapeNode } from "./mindscape-node";
import { useLOD, useNodeFocus } from "../lod";

export function IntegrationsNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  const _parsed = integrationsNodeDataSchema.safeParse(data);
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const linearStatusQuery = trpc.linear.getStatus.useQuery();
  const getAuthorizeUrlMutation = trpc.linear.getAuthorizeUrl.useMutation();

  const handleLinearConnect = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const result = await getAuthorizeUrlMutation.mutateAsync({
        redirectUri: `${window.location.origin}/auth/callback/linear`,
      });
      if (result.state) {
        sessionStorage.setItem("linear_oauth_state", result.state);
      }
      window.location.href = result.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start OAuth flow";
      toast.error(message);
    }
  }, [getAuthorizeUrlMutation]);

  const linearStatus = linearStatusQuery.data;
  const isLinearConnected = linearStatus?.connected ?? false;
  const isLinearExpired = linearStatus?.connected && linearStatus?.isExpired;

  useEffect(() => {
    if (linearStatus?.workspace) {
      updateArtifactData(id, { lastLinearStatus: linearStatus.workspace });
    }
  }, [linearStatus?.workspace, id, updateArtifactData]);

  // LOD 0: Tiny
  if (lod === "tiny") {
    return (
      <div className="flex h-3 w-3 items-center justify-center rounded-full bg-cyan-500/40 backdrop-blur-sm">
        <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
      </div>
    );
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-void-surface/40 px-3 py-1 backdrop-blur-md transition-colors hover:border-cyan-500/50">
        <PlugZap className="h-3 w-3 text-cyan-400" />
        <span className="font-medium text-[10px] text-cyan-300 tracking-tight">
          Integrations
        </span>
      </div>
    );
  }

  return (
    <MindscapeNode
      className="w-[420px] border-cyan-500/20 bg-cyan-950/10"
      headerActions={<PlugZap className="h-4 w-4 text-cyan-200" />}
      id={id}
      selected={selected}
      title="Integrations"
    >
      <div className="flex flex-col gap-4 p-4">
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-biolum text-sm">Linear</p>
              <p className="text-biolum-faint text-xs">
                Project management & issue tracking
              </p>
            </div>
            <BiolumBadge
              variant={
                isLinearConnected
                  ? isLinearExpired
                    ? "warning"
                    : "success"
                  : "default"
              }
            >
              {isLinearConnected
                ? isLinearExpired
                  ? "Expired"
                  : "Connected"
                : "Not Connected"}
            </BiolumBadge>
          </div>
          {linearStatus?.workspace && !isLinearExpired && (
            <p className="mt-2 text-biolum-faint text-xs">
              Workspace: {linearStatus.workspace}
            </p>
          )}
          {isLinearExpired && (
            <p className="mt-2 text-amber-300 text-xs">
              Connection expired. Reconnect below.
            </p>
          )}
          <Button
            className="mt-4 w-full"
            disabled={getAuthorizeUrlMutation.isPending}
            onClick={handleLinearConnect}
          >
            {getAuthorizeUrlMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Contacting Linear…
              </span>
            ) : (
              <>
                {isLinearConnected && !isLinearExpired
                  ? "Reconnect Linear"
                  : "Connect Linear"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-biolum text-sm">Laminar</p>
              <p className="text-biolum-faint text-xs">
                LLM observability + evals
              </p>
            </div>
            <BiolumBadge variant="default">Manual</BiolumBadge>
          </div>
          <p className="mt-2 text-biolum-faint text-xs">
            Configure Laminar via environment variables to stream evaluation
            data from workflows.
          </p>
          <Button className="mt-4 w-full" disabled variant="outline">
            Configure in env
          </Button>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-biolum text-sm">Security</p>
              <p className="text-biolum-faint text-xs">
                Privacy & policy webhooks
              </p>
            </div>
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
          </div>
          <p className="mt-2 text-biolum-faint text-xs">
            Configure outbound webhooks and policy actions from the Privacy
            node.
          </p>
        </section>
      </div>
    </MindscapeNode>
  );
}
