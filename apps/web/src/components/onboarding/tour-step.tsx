import {
  BookMarked,
  CheckCircle,
  MessageSquare,
  PlayCircle,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export interface TourStepProps {
  onComplete: () => void;
}

export function TourStep({ onComplete }: TourStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <h2 className="font-bold text-2xl text-biolum tracking-tighter">
          Quick Feature Tour
        </h2>
        <p className="text-biolum-dim">Here's what you can do with ALFRED:</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-4 rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <div className="rounded-full bg-biolum/20 p-3">
            <MessageSquare className="h-5 w-5 text-biolum" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-biolum tracking-tight">
              Chat Interface
            </h3>
            <p className="text-biolum-dim text-sm">
              Talk to ALFRED using text or voice. Get help with tasks, ask
              questions, or execute workflows.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <div className="rounded-full bg-biolum/20 p-3">
            <PlayCircle className="h-5 w-5 text-biolum" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-biolum tracking-tight">
              Workflow Automation
            </h3>
            <p className="text-biolum-dim text-sm">
              Execute complex multi-step workflows with AI-powered planning and
              tool chaining.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <div className="rounded-full bg-biolum/20 p-3">
            <BookMarked className="h-5 w-5 text-biolum" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-biolum tracking-tight">
              Personal Management
            </h3>
            <p className="text-biolum-dim text-sm">
              Manage notes, reminders, timers, and bookmarks with semantic
              search.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <div className="rounded-full bg-biolum/20 p-3">
            <Settings className="h-5 w-5 text-biolum" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-biolum tracking-tight">
              Customization
            </h3>
            <p className="text-biolum-dim text-sm">
              Adjust autonomy levels, privacy settings, and voice preferences to
              match your workflow.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-6">
        <Button className="rounded-full px-8" onClick={onComplete}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Get Started
        </Button>
      </div>
    </div>
  );
}
