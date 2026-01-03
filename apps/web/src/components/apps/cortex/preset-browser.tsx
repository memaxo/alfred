"use client";

/**
 * Preset Browser - Browse and apply visualization presets
 */

import { Eye, Sparkles, Wallpaper } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CortexPreset } from "./index";

type PresetBrowserProps = {
  selectedId?: string;
  onSelect: (preset: CortexPreset) => void;
};

const mockPresets: CortexPreset[] = [
  {
    id: "orb-idle",
    name: "Idle Pulse",
    description: "Gentle pulsing for idle state",
    category: "orb",
    parameters: { intensity: 0.3, frequency: 0.5, speed: 0.5 },
  },
  {
    id: "orb-thinking",
    name: "Deep Thought",
    description: "Rotating pattern for processing",
    category: "orb",
    parameters: { intensity: 0.8, frequency: 2.0, speed: 2.0 },
  },
  {
    id: "orb-active",
    name: "Full Power",
    description: "High intensity for active state",
    category: "orb",
    parameters: { intensity: 1.0, frequency: 3.0, speed: 2.5 },
  },
  {
    id: "wall-aurora",
    name: "Aurora",
    description: "Northern lights effect",
    category: "wallpaper",
    parameters: { intensity: 0.6, frequency: 1.0, colorShift: 0.5 },
  },
  {
    id: "wall-waves",
    name: "Ocean Waves",
    description: "Calm wave animation",
    category: "wallpaper",
    parameters: { intensity: 0.4, frequency: 0.8, amplitude: 1.2 },
  },
  {
    id: "graph-flow",
    name: "Data Flow",
    description: "Flowing data visualization",
    category: "graph",
    parameters: { intensity: 0.7, frequency: 1.5, speed: 1.0 },
  },
];

const categoryIcons = {
  orb: Eye,
  wallpaper: Wallpaper,
  graph: Sparkles,
};

const categoryColors = {
  orb: "text-biolum",
  wallpaper: "text-purple-400",
  graph: "text-green-400",
};

export function PresetBrowser({ selectedId, onSelect }: PresetBrowserProps) {
  const grouped = mockPresets.reduce<Record<string, CortexPreset[]>>(
    (acc, preset) => {
      const category = preset.category;
      const existing = acc[category] ?? [];
      acc[category] = [...existing, preset];
      return acc;
    },
    {}
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        {Object.entries(grouped).map(([category, presets]) => {
          const Icon =
            categoryIcons[category as keyof typeof categoryIcons] ?? Eye;
          const color =
            categoryColors[category as keyof typeof categoryColors] ??
            "text-biolum";

          return (
            <div className="mb-4" key={category}>
              <div className="mb-2 flex items-center gap-2 px-2 text-xs uppercase tracking-wider">
                <Icon className={cn("h-3 w-3", color)} />
                <span className="text-biolum-dim">{category}</span>
              </div>

              <div className="space-y-1">
                {presets.map((preset) => (
                  <button
                    className={cn(
                      "w-full rounded-lg p-2 text-left transition-colors",
                      selectedId === preset.id
                        ? "bg-biolum/20 text-biolum"
                        : "hover:bg-white/5"
                    )}
                    key={preset.id}
                    onClick={() => onSelect(preset)}
                    type="button"
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-biolum-dim text-xs">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
