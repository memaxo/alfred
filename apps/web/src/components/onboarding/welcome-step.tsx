import { Bot, Sparkles, Zap } from "lucide-react";

export function WelcomeStep() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h1 className="text-biolum tracking-tighter text-4xl font-bold">
          Welcome to ALFRED
        </h1>
        <p className="text-biolum-dim text-lg">
          Your personal AI assistant for workflow automation, productivity, and infrastructure management.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mt-8">
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-biolum/20 p-4">
              <Bot className="h-8 w-8 text-biolum" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="text-biolum tracking-tight font-medium mb-2">
            AI-Powered Workflows
          </h3>
          <p className="text-biolum-dim text-sm">
            Execute complex multi-step workflows with AI SDK v6 and tool chaining.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-biolum/20 p-4">
              <Sparkles className="h-8 w-8 text-biolum" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="text-biolum tracking-tight font-medium mb-2">
            Intelligent Memory
          </h3>
          <p className="text-biolum-dim text-sm">
            Knowledge graph and semantic search with local embeddings for privacy.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-biolum/20 p-4">
              <Zap className="h-8 w-8 text-biolum" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="text-biolum tracking-tight font-medium mb-2">
            Voice-First
          </h3>
          <p className="text-biolum-dim text-sm">
            Local voice models (Faster-Whisper + Piper) for zero-cost, privacy-preserving interaction.
          </p>
        </div>
      </div>
    </div>
  );
}

