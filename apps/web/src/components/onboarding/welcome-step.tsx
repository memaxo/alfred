import { Bot, Sparkles, Zap } from "lucide-react";

export function WelcomeStep() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <h1 className="font-bold text-4xl text-biolum tracking-tighter">
          Welcome to ALFRED
        </h1>
        <p className="text-biolum-dim text-lg">
          Your personal AI assistant for workflow automation, productivity, and
          infrastructure management.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 text-center backdrop-blur-xl">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-biolum/20 p-4">
              <Bot className="h-8 w-8 text-biolum" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="mb-2 font-medium text-biolum tracking-tight">
            AI-Powered Workflows
          </h3>
          <p className="text-biolum-dim text-sm">
            Execute complex multi-step workflows with AI SDK v6 and tool
            chaining.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 text-center backdrop-blur-xl">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-biolum/20 p-4">
              <Sparkles className="h-8 w-8 text-biolum" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="mb-2 font-medium text-biolum tracking-tight">
            Intelligent Memory
          </h3>
          <p className="text-biolum-dim text-sm">
            Knowledge graph and semantic search with local embeddings for
            privacy.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 text-center backdrop-blur-xl">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-biolum/20 p-4">
              <Zap className="h-8 w-8 text-biolum" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="mb-2 font-medium text-biolum tracking-tight">
            Voice-First
          </h3>
          <p className="text-biolum-dim text-sm">
            Local voice models (Faster-Whisper + Piper) for zero-cost,
            privacy-preserving interaction.
          </p>
        </div>
      </div>
    </div>
  );
}
