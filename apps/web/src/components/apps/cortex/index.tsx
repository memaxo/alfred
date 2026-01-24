"use client";

/**
 * Cortex Visualizer - WebGPU shader visualization and configuration
 *
 * Configure and preview WebGPU shader-based visualizations for the Orb,
 * living wallpaper, and knowledge graph rendering.
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.1
 */

import {
  Activity,
  Code,
  Cpu,
  Download,
  MonitorCog,
  Palette,
  Sliders,
} from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { GpuMonitor } from "./gpu-monitor";
import { ParameterTuner } from "./parameter-tuner";
import { PhysiologyMonitor } from "./physiology-monitor";
import { PresetBrowser } from "./preset-browser";
import { ShaderPreview } from "./shader-preview";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CortexPreset = {
  id: string;
  name: string;
  description: string;
  category: "orb" | "wallpaper" | "graph";
  parameters: Record<string, number>;
  shader?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function CortexApp({ window: _window }: WindowComponentProps) {
  const [selectedPreset, setSelectedPreset] = useState<CortexPreset | null>(
    null
  );
  const [showMonitor, setShowMonitor] = useState(false);
  const [tab, setTab] = useState<
    "presets" | "parameters" | "physiology" | "editor"
  >("physiology");

  return (
    <div className="flex h-full flex-col bg-void">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Cortex Analyzer</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            className={cn("h-7", showMonitor && "bg-biolum/20")}
            onClick={() => setShowMonitor(!showMonitor)}
            size="sm"
            variant="ghost"
          >
            <MonitorCog className="mr-1 h-3 w-3" />
            GPU
          </Button>
          <Button className="h-7" size="sm" variant="ghost">
            <Download className="mr-1 h-3 w-3" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="flex w-64 flex-col border-white/5 border-r">
          {/* Tabs */}
          <div className="flex border-white/5 border-b">
            {[
              { id: "physiology", icon: Activity, label: "Physiology" },
              { id: "presets", icon: Palette, label: "Presets" },
              { id: "parameters", icon: Sliders, label: "Params" },
              { id: "editor", icon: Code, label: "WGSL" },
            ].map((t) => (
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 py-2 text-[10px] transition-colors",
                  tab === t.id
                    ? "border-biolum border-b-2 text-biolum"
                    : "text-biolum-dim hover:text-biolum"
                )}
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                type="button"
              >
                <t.icon className="h-3 w-3" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {tab === "physiology" && (
              <div className="p-3 text-biolum-dim text-xs">
                <p>Monitoring internal cognitive signals and drive levels.</p>
              </div>
            )}
            {tab === "presets" && (
              <PresetBrowser
                onSelect={setSelectedPreset}
                selectedId={selectedPreset?.id}
              />
            )}
            {tab === "parameters" && <ParameterTuner preset={selectedPreset} />}
            {tab === "editor" && (
              <div className="p-3 text-biolum-dim text-xs">
                <p>WGSL shader editor coming soon.</p>
                <p className="mt-2">
                  Advanced users can edit shader code directly.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-auto">
          {tab === "physiology" ? (
            <PhysiologyMonitor />
          ) : (
            <>
              {/* Shader Preview */}
              <div className="flex-1">
                <ShaderPreview preset={selectedPreset} />
              </div>

              {/* GPU Monitor */}
              {showMonitor && (
                <div className="h-32 border-white/5 border-t">
                  <GpuMonitor />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Window wrapper
export function CortexAppWindow(props: WindowComponentProps) {
  return <CortexApp {...props} />;
}
