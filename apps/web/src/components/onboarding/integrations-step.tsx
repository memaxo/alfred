import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export type IntegrationsStepProps = {
  onSkip: () => void;
};

export function IntegrationsStep({ onSkip }: IntegrationsStepProps) {
  const handleLinearConnect = () => {
    window.open("https://linear.app/oauth/authorize", "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-biolum tracking-tighter text-2xl font-bold">
          Connect Your Tools
        </h2>
        <p className="text-biolum-dim">
          Connect ALFRED with your favorite tools. You can skip this and connect later.
        </p>
      </div>

      <div className="space-y-4">
        {/* Linear */}
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-biolum tracking-tight font-medium mb-1">
                Linear
              </h3>
              <p className="text-biolum-dim text-sm">
                Project management and issue tracking with real-time activity updates.
              </p>
            </div>
            <Button
              onClick={handleLinearConnect}
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              Connect
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Laminar */}
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-biolum tracking-tight font-medium mb-1">
                Laminar
              </h3>
              <p className="text-biolum-dim text-sm">
                LLM observability and workflow evaluation tracking.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled
            >
              Coming Soon
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button
          onClick={onSkip}
          variant="ghost"
          className="text-biolum-dim hover:text-biolum"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}

