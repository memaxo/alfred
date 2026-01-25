import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface IntegrationsStepProps {
  onSkip: () => void;
}

export function IntegrationsStep({ onSkip }: IntegrationsStepProps) {
  const handleLinearConnect = () => {
    window.open("https://linear.app/oauth/authorize", "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <h2 className="font-bold text-2xl text-biolum tracking-tighter">
          Connect Your Tools
        </h2>
        <p className="text-biolum-dim">
          Connect ALFRED with your favorite tools. You can skip this and connect
          later.
        </p>
      </div>

      <div className="space-y-4">
        {/* Linear */}
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="mb-1 font-medium text-biolum tracking-tight">
                Linear
              </h3>
              <p className="text-biolum-dim text-sm">
                Project management and issue tracking with real-time activity
                updates.
              </p>
            </div>
            <Button
              className="rounded-full"
              onClick={handleLinearConnect}
              size="sm"
              variant="outline"
            >
              Connect
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Laminar */}
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="mb-1 font-medium text-biolum tracking-tight">
                Laminar
              </h3>
              <p className="text-biolum-dim text-sm">
                LLM observability and workflow evaluation tracking.
              </p>
            </div>
            <Button
              className="rounded-full"
              disabled
              size="sm"
              variant="outline"
            >
              Coming Soon
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button
          className="text-biolum-dim hover:text-biolum"
          onClick={onSkip}
          variant="ghost"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
