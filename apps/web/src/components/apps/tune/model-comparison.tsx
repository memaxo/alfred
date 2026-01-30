/**
 * Model Comparison - Compare model performance metrics
 */

import { cn } from "@/lib/utils";

interface ModelMetrics {
  name: string;
  accuracy: number;
  latency: number;
  tokensPerSec: number;
  memoryUsage: number;
}

const mockModels: ModelMetrics[] = [
  {
    name: "Code Assistant v2",
    accuracy: 0.87,
    latency: 120,
    tokensPerSec: 45,
    memoryUsage: 14.2,
  },
  {
    name: "Reasoning Tuned",
    accuracy: 0.92,
    latency: 180,
    tokensPerSec: 32,
    memoryUsage: 16.8,
  },
  {
    name: "Base (llama-3-8b)",
    accuracy: 0.78,
    latency: 95,
    tokensPerSec: 52,
    memoryUsage: 12.1,
  },
];

export function ModelComparison() {
  const maxAccuracy = Math.max(...mockModels.map((m) => m.accuracy));
  const maxLatency = Math.max(...mockModels.map((m) => m.latency));
  const maxTps = Math.max(...mockModels.map((m) => m.tokensPerSec));

  return (
    <div className="p-4">
      <div className="rounded-lg border border-white/10 bg-white/5">
        <table className="w-full">
          <thead>
            <tr className="border-white/10 border-b text-left text-xs">
              <th className="p-3 text-biolum-dim">Model</th>
              <th className="p-3 text-biolum-dim">Accuracy</th>
              <th className="p-3 text-biolum-dim">Latency</th>
              <th className="p-3 text-biolum-dim">Tokens/sec</th>
              <th className="p-3 text-biolum-dim">Memory</th>
            </tr>
          </thead>
          <tbody>
            {mockModels.map((model) => (
              <tr className="border-white/5 border-b" key={model.name}>
                <td className="p-3 font-medium">{model.name}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          model.accuracy === maxAccuracy
                            ? "bg-green-500"
                            : "bg-green-500/60"
                        )}
                        style={{ width: `${model.accuracy * 100}%` }}
                      />
                    </div>
                    <span className="text-sm">
                      {(model.accuracy * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          model.latency ===
                            Math.min(...mockModels.map((m) => m.latency))
                            ? "bg-blue-500"
                            : "bg-blue-500/60"
                        )}
                        style={{
                          width: `${(model.latency / maxLatency) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm">{model.latency}ms</span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          model.tokensPerSec === maxTps
                            ? "bg-purple-500"
                            : "bg-purple-500/60"
                        )}
                        style={{
                          width: `${(model.tokensPerSec / maxTps) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm">{model.tokensPerSec}</span>
                  </div>
                </td>
                <td className="p-3">
                  <span className="text-sm">{model.memoryUsage} GB</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
