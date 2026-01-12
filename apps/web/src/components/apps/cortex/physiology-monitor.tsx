"use client";

import { Activity, Battery, Flame, type LucideIcon, Zap } from "lucide-react";
import { Number as SlidingNumber } from "@/components/number";
import { useCognitivePhysiology } from "@/hooks/use-cognitive-physiology";
import { cn } from "@/lib/utils";

export function PhysiologyMonitor() {
  const { energy, boredom, frustration, entropy } = useCognitivePhysiology();

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricGauge
          color="text-emerald-400"
          description="Remaining cognitive capacity"
          icon={Battery}
          label="Energy"
          value={energy}
        />
        <MetricGauge
          color="text-orange-400"
          description="Frustration level from errors"
          icon={Flame}
          label="Frustration"
          value={frustration}
        />
        <MetricGauge
          color="text-blue-400"
          description="System state predictability"
          icon={Activity}
          label="Entropy"
          value={entropy}
        />
        <MetricGauge
          color="text-purple-400"
          description="Lack of novelty/stimulus"
          icon={Zap}
          label="Boredom"
          value={boredom}
        />
      </div>

      <div className="flex-1 rounded-3xl border border-white/5 bg-white/5 p-6">
        <h3 className="mb-4 font-medium text-biolum text-sm uppercase tracking-widest opacity-60">
          Real-time Signal
        </h3>
        <div className="flex h-48 items-center justify-center border-white/5 border-t border-b py-10">
          {/* Waveform placeholder */}
          <div className="flex h-20 items-end gap-1">
            {new Array(40).fill(0).map((_, i) => (
              <div
                className="w-1 rounded-full bg-biolum/20 transition-all duration-500"
                key={i}
                style={{
                  height: `${Math.random() * 100}%`,
                  opacity: 0.2 + Math.random() * 0.8,
                }}
              />
            ))}
          </div>
        </div>
        <p className="mt-4 text-center text-biolum-dim text-xs italic">
          High entropy indicates divergent reasoning or recursive loops.
        </p>
      </div>
    </div>
  );
}

function MetricGauge({
  label,
  value,
  icon: Icon,
  color,
  description,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-void-surface/40 p-4 transition-all hover:border-white/20">
      <div className="mb-2 flex items-center justify-between">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="font-mono text-biolum text-xl">
          <SlidingNumber value={Math.round(value * 100)} />%
        </span>
      </div>
      <div className="font-medium text-biolum text-sm">{label}</div>
      <p className="mt-1 text-[10px] text-biolum-dim leading-relaxed">
        {description}
      </p>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn(
            "h-full transition-all duration-1000",
            color.replace("text", "bg")
          )}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
