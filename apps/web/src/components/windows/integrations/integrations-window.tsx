import type { NodeProps } from "@xyflow/react";

import { ExternalLink, Loader2, PlugZap } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { BiolumBadge, type BiolumBadgeVariant } from "@/components/tremor";
import { Button } from "@/components/ui/button";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { hasWindow } from "@/lib/env/isomorphic";
import { trpc } from "@/utils/trpc";

const integrationsWindowDataSchema = z.object({
  type: z.literal("integrations"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
});

export function IntegrationsWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  integrationsWindowDataSchema.safeParse(data);

  const linearStatusQuery = trpc.linear.getStatus.useQuery();
  const getAuthorizeUrlMutation = trpc.linear.getAuthorizeUrl.useMutation();

  const handleLinearConnect = useCallback(async () => {
    if (!hasWindow()) {
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

  let linearBadgeVariant: BiolumBadgeVariant = "default";
  let linearBadgeText = "Not Connected";
  if (isLinearConnected) {
    if (isLinearExpired) {
      linearBadgeVariant = "warning";
      linearBadgeText = "Expired";
    } else {
      linearBadgeVariant = "success";
      linearBadgeText = "Connected";
    }
  }

  if (lod === "tiny") {
    return <TinyDot color="bg-cyan-500" shadow="shadow-cyan-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-cyan-500/30"
        hoverColor="hover:border-cyan-500/50"
        icon={<PlugZap className="h-3 w-3" />}
        label="Integrations"
        textColor="text-cyan-300"
      />
    );
  }

  return (
    <WindowFrame
      actions={<PlugZap className="h-4 w-4 text-cyan-200" />}
      id={id}
      selected={selected}
      title="Integrations"
      width={440}
      windowType="integrations"
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
            <BiolumBadge variant={linearBadgeVariant}>
              {linearBadgeText}
            </BiolumBadge>
          </div>
          {linearStatus?.connected &&
            linearStatus.workspace &&
            !isLinearExpired && (
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
            Configure in environment variables. Set LAMINAR_PROJECT_API_KEY.
          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-biolum text-sm">GitHub</p>
              <p className="text-biolum-faint text-xs">
                Code repositories & PRs
              </p>
            </div>
            <BiolumBadge variant="default">Coming Soon</BiolumBadge>
          </div>
        </section>
      </div>
    </WindowFrame>
  );
}
