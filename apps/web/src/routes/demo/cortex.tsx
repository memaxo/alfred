/**
 * Cortex Visual Configuration Demo
 *
 * Developer-focused demo page for fine-tuning Cortex visual parameters.
 * Provides full access to all configuration options with real-time preview.
 */

import { PRESET_METADATA } from "@alfred/cortex";
import type { VisualConfig, VisualPreset } from "@alfred/type";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Copy,
  Download,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@/components/ai-elements/client-only";
import { Button } from "@/components/ui/button";
import {
  PresetCard,
  PresetGrid,
  VisualColorPicker,
  VisualSection,
  VisualSlider,
  VisualToggle,
} from "@/components/visual-config";
import { useCortexEngine } from "@/hooks/use-cortex-engine";
import { useVisualPreferences } from "@/hooks/use-visual-preferences";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo/cortex")({
  ssr: false, // Uses Cortex Canvas - browser-only
  component: CortexDemoPage,
});

function CortexDemoPage() {
  return (
    <ClientOnly>
      <CortexDemo />
    </ClientOnly>
  );
}

function CortexDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Performance monitoring
  const [fps, setFps] = useState(0);
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());

  // Initialize Cortex engine
  const { engine, capability, isReady, error } = useCortexEngine(canvasRef, {
    postProcessing: true,
    autoStart: true,
  });

  // Visual preferences hook
  const {
    config,
    isLoading,
    isDirty,
    updateConfig,
    applyPreset,
    reset,
    save,
    exportConfig,
    importConfig,
  } = useVisualPreferences({ engine, autoApply: true });

  // FPS monitoring
  useEffect(() => {
    if (!engine) {
      return;
    }

    let animId: number;
    const measureFps = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      const avgDelta =
        frameTimesRef.current.reduce((a, b) => a + b, 0) /
        frameTimesRef.current.length;
      setFps(Math.round(1000 / avgDelta));

      animId = requestAnimationFrame(measureFps);
    };

    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, [engine]);

  // Export handler
  const handleExport = useCallback(() => {
    const json = exportConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cortex-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportConfig]);

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(exportConfig());
  }, [exportConfig]);

  // Import handler
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const json = evt.target?.result as string;
        importConfig(json);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [importConfig]
  );

  // Helper to update nested config
  const updateParticles = useCallback(
    (updates: Partial<VisualConfig["particles"]>) =>
      updateConfig({ particles: updates }),
    [updateConfig]
  );

  const updateCorona = useCallback(
    (updates: Partial<VisualConfig["corona"]>) =>
      updateConfig({ corona: updates }),
    [updateConfig]
  );

  const updateBloom = useCallback(
    (updates: Partial<VisualConfig["bloom"]>) =>
      updateConfig({ bloom: updates }),
    [updateConfig]
  );

  const updateChromatic = useCallback(
    (updates: Partial<VisualConfig["chromaticAberration"]>) =>
      updateConfig({ chromaticAberration: updates }),
    [updateConfig]
  );

  const updateAtmosphere = useCallback(
    (updates: Partial<VisualConfig["atmosphere"]>) =>
      updateConfig({ atmosphere: updates }),
    [updateConfig]
  );

  const updateNodes = useCallback(
    (updates: Partial<VisualConfig["nodes"]>) =>
      updateConfig({ nodes: updates }),
    [updateConfig]
  );

  const updateEdges = useCallback(
    (updates: Partial<VisualConfig["edges"]>) =>
      updateConfig({ edges: updates }),
    [updateConfig]
  );

  const updateColors = useCallback(
    (updates: Partial<VisualConfig["colors"]>) =>
      updateConfig({ colors: updates }),
    [updateConfig]
  );

  return (
    <div className="flex h-screen bg-void">
      {/* Canvas area */}
      <div className="relative flex-1">
        <canvas
          className="absolute inset-0 h-full w-full"
          ref={canvasRef}
          style={{ background: "oklch(0.05 0 0)" }}
        />

        {/* Status overlay */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {/* Capability badge */}
          <div
            className={cn(
              "rounded-full px-3 py-1 font-mono text-xs",
              "border border-white/10 bg-void-surface/80 backdrop-blur-sm",
              capability === "webgpu"
                ? "text-emerald-400"
                : capability === "webgl"
                  ? "text-amber-400"
                  : "text-rose-400"
            )}
          >
            {capability?.toUpperCase() ?? "DETECTING..."}
          </div>

          {/* FPS counter */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs",
              "border border-white/10 bg-void-surface/80 backdrop-blur-sm",
              fps >= 55
                ? "text-emerald-400"
                : fps >= 30
                  ? "text-amber-400"
                  : "text-rose-400"
            )}
          >
            <Activity className="h-3 w-3" strokeWidth={1.5} />
            {fps} FPS
          </div>
        </div>

        {/* Loading/error states */}
        {!(isReady || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-void/80">
            <div className="animate-pulse text-biolum-dim">
              Initializing Cortex...
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-void/80">
            <div className="text-rose-400">{error.message}</div>
          </div>
        )}
      </div>

      {/* Controls panel */}
      <div className="w-96 overflow-y-auto border-white/10 border-l bg-void-surface/50 backdrop-blur-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-white/10 border-b bg-void-surface/90 p-4 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-semibold text-biolum text-lg tracking-tight">
              Cortex Configuration
            </h1>
            <div className="flex items-center gap-2">
              {isDirty && (
                <span className="text-amber-400 text-xs">Unsaved</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              disabled={!isDirty || isLoading}
              onClick={save}
              size="sm"
              variant="ghost"
            >
              <Save className="mr-1 h-4 w-4" strokeWidth={1.5} />
              Save
            </Button>
            <Button
              className="rounded-full"
              onClick={reset}
              size="sm"
              variant="ghost"
            >
              <RefreshCw className="mr-1 h-4 w-4" strokeWidth={1.5} />
              Reset
            </Button>
            <Button
              className="rounded-full"
              onClick={handleExport}
              size="sm"
              variant="ghost"
            >
              <Download className="mr-1 h-4 w-4" strokeWidth={1.5} />
              Export
            </Button>
            <Button
              className="rounded-full"
              onClick={handleCopy}
              size="sm"
              variant="ghost"
            >
              <Copy className="mr-1 h-4 w-4" strokeWidth={1.5} />
              Copy
            </Button>
            <Button
              className="rounded-full"
              onClick={handleImport}
              size="sm"
              variant="ghost"
            >
              <Upload className="mr-1 h-4 w-4" strokeWidth={1.5} />
              Import
            </Button>
            <input
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-4 p-4">
          <h2 className="font-semibold text-biolum-dim text-sm uppercase tracking-wider">
            Presets
          </h2>
          <PresetGrid>
            {PRESET_METADATA.map((preset) => (
              <PresetCard
                description={preset.description}
                key={preset.id}
                name={preset.name}
                onSelect={() => applyPreset(preset.id as VisualPreset)}
                preset={preset.id as VisualPreset}
                recommended={preset.recommended}
                selected={config.preset === preset.id}
              />
            ))}
          </PresetGrid>
        </div>

        {/* Configuration sections */}
        <div className="space-y-4 p-4">
          {/* Particles */}
          <VisualSection
            description="Gravitational particle system"
            title="Particles"
          >
            <VisualSlider
              label="Particle Count"
              max={10_000}
              min={100}
              onChange={(count) => updateParticles({ count })}
              step={100}
              value={config.particles.count}
            />
            <VisualSlider
              label="Spawn Radius"
              max={1200}
              min={200}
              onChange={(spawnRadius) => updateParticles({ spawnRadius })}
              unit="px"
              value={config.particles.spawnRadius}
            />
            <VisualSlider
              label="Gravity Constant"
              max={10_000}
              min={1000}
              onChange={(gravityConstant) =>
                updateParticles({ gravityConstant })
              }
              step={100}
              value={config.particles.gravityConstant}
            />
            <VisualSlider
              decimals={3}
              label="Damping"
              max={0.999}
              min={0.9}
              onChange={(damping) => updateParticles({ damping })}
              step={0.001}
              value={config.particles.damping}
            />
          </VisualSection>

          {/* Corona */}
          <VisualSection description="Fibrous spiral corona" title="Corona">
            <VisualSlider
              label="Fiber Count"
              max={5000}
              min={200}
              onChange={(fiberCount) => updateCorona({ fiberCount })}
              step={100}
              value={config.corona.fiberCount}
            />
            <VisualSlider
              label="Segments per Fiber"
              max={100}
              min={10}
              onChange={(segmentsPerFiber) =>
                updateCorona({ segmentsPerFiber })
              }
              value={config.corona.segmentsPerFiber}
            />
            <VisualSlider
              label="Inner Radius"
              max={300}
              min={50}
              onChange={(innerRadius) => updateCorona({ innerRadius })}
              unit="px"
              value={config.corona.innerRadius}
            />
            <VisualSlider
              label="Outer Radius"
              max={800}
              min={200}
              onChange={(outerRadius) => updateCorona({ outerRadius })}
              unit="px"
              value={config.corona.outerRadius}
            />
            <VisualSlider
              decimals={2}
              label="Rotation Speed"
              max={0.5}
              min={0.01}
              onChange={(rotationSpeed) => updateCorona({ rotationSpeed })}
              step={0.01}
              unit="rad/s"
              value={config.corona.rotationSpeed}
            />
            <VisualSlider
              decimals={2}
              label="Spiral Tightness"
              max={0.5}
              min={0.05}
              onChange={(spiralTightness) => updateCorona({ spiralTightness })}
              step={0.01}
              value={config.corona.spiralTightness}
            />
            <VisualSlider
              decimals={2}
              label="Wobble Amplitude"
              max={0.5}
              min={0}
              onChange={(wobbleAmplitude) => updateCorona({ wobbleAmplitude })}
              step={0.01}
              value={config.corona.wobbleAmplitude}
            />
          </VisualSection>

          {/* Post-Processing */}
          <VisualSection
            description="Bloom and effects"
            title="Post-Processing"
          >
            <VisualToggle
              checked={config.bloom.enabled}
              label="Bloom Enabled"
              onChange={(enabled) => updateBloom({ enabled })}
            />
            <VisualSlider
              decimals={2}
              label="Bloom Threshold"
              max={2}
              min={0}
              onChange={(threshold) => updateBloom({ threshold })}
              step={0.05}
              value={config.bloom.threshold}
            />
            <VisualSlider
              decimals={2}
              label="Bloom Intensity"
              max={2}
              min={0}
              onChange={(intensity) => updateBloom({ intensity })}
              step={0.05}
              value={config.bloom.intensity}
            />
            <VisualSlider
              decimals={1}
              label="Blur Radius"
              max={5}
              min={0.5}
              onChange={(blurRadius) => updateBloom({ blurRadius })}
              step={0.1}
              value={config.bloom.blurRadius}
            />
            <VisualToggle
              checked={config.chromaticAberration.enabled}
              label="Chromatic Aberration"
              onChange={(enabled) => updateChromatic({ enabled })}
            />
            <VisualSlider
              decimals={3}
              label="Aberration Intensity"
              max={0.02}
              min={0}
              onChange={(intensity) => updateChromatic({ intensity })}
              step={0.001}
              value={config.chromaticAberration.intensity}
            />
          </VisualSection>

          {/* Atmosphere */}
          <VisualSection
            defaultExpanded={false}
            description="Fog and depth effects"
            title="Atmosphere"
          >
            <VisualToggle
              checked={config.atmosphere.enabled}
              label="Atmosphere Enabled"
              onChange={(enabled) => updateAtmosphere({ enabled })}
            />
            <VisualSlider
              decimals={2}
              label="Fog Density"
              max={0.5}
              min={0}
              onChange={(fogDensity) => updateAtmosphere({ fogDensity })}
              step={0.01}
              value={config.atmosphere.fogDensity}
            />
            <VisualSlider
              label="Fog Inner Radius"
              max={400}
              min={100}
              onChange={(fogInnerRadius) =>
                updateAtmosphere({ fogInnerRadius })
              }
              unit="px"
              value={config.atmosphere.fogInnerRadius}
            />
            <VisualSlider
              label="Fog Outer Radius"
              max={1000}
              min={400}
              onChange={(fogOuterRadius) =>
                updateAtmosphere({ fogOuterRadius })
              }
              unit="px"
              value={config.atmosphere.fogOuterRadius}
            />
            <VisualSlider
              decimals={2}
              label="Fiber Intensity"
              max={0.2}
              min={0}
              onChange={(fiberIntensity) =>
                updateAtmosphere({ fiberIntensity })
              }
              step={0.01}
              value={config.atmosphere.fiberIntensity}
            />
            <VisualSlider
              decimals={2}
              label="Vignette Intensity"
              max={1}
              min={0}
              onChange={(vignetteIntensity) =>
                updateAtmosphere({ vignetteIntensity })
              }
              step={0.05}
              value={config.atmosphere.vignetteIntensity}
            />
          </VisualSection>

          {/* Nodes */}
          <VisualSection
            defaultExpanded={false}
            description="Satellite node rendering"
            title="Nodes"
          >
            <VisualSlider
              decimals={2}
              label="Glow Intensity"
              max={1}
              min={0}
              onChange={(glowIntensity) => updateNodes({ glowIntensity })}
              step={0.05}
              value={config.nodes.glowIntensity}
            />
            <VisualSlider
              decimals={3}
              label="Outer Glow Falloff"
              max={0.1}
              min={0.01}
              onChange={(outerGlowFalloff) => updateNodes({ outerGlowFalloff })}
              step={0.005}
              value={config.nodes.outerGlowFalloff}
            />
            <VisualSlider
              decimals={2}
              label="Inner Glow Intensity"
              max={1}
              min={0}
              onChange={(innerGlowIntensity) =>
                updateNodes({ innerGlowIntensity })
              }
              step={0.05}
              value={config.nodes.innerGlowIntensity}
            />
            <VisualSlider
              decimals={1}
              label="Ring Width"
              max={5}
              min={1}
              onChange={(ringWidth) => updateNodes({ ringWidth })}
              step={0.5}
              unit="px"
              value={config.nodes.ringWidth}
            />
            <VisualSlider
              decimals={1}
              label="Activity Pulse Speed"
              max={10}
              min={0.5}
              onChange={(activityPulseSpeed) =>
                updateNodes({ activityPulseSpeed })
              }
              step={0.5}
              value={config.nodes.activityPulseSpeed}
            />
          </VisualSection>

          {/* Edges */}
          <VisualSection
            defaultExpanded={false}
            description="Connection rendering"
            title="Edges"
          >
            <VisualSlider
              decimals={2}
              label="Particle Speed"
              max={0.5}
              min={0.05}
              onChange={(particleSpeed) => updateEdges({ particleSpeed })}
              step={0.01}
              value={config.edges.particleSpeed}
            />
            <VisualSlider
              label="Particles per Edge"
              max={500}
              min={20}
              onChange={(particlesPerEdge) => updateEdges({ particlesPerEdge })}
              step={10}
              value={config.edges.particlesPerEdge}
            />
            <VisualSlider
              decimals={2}
              label="Curvature"
              max={0.8}
              min={0}
              onChange={(curvature) => updateEdges({ curvature })}
              step={0.05}
              value={config.edges.curvature}
            />
            <VisualSlider
              decimals={1}
              label="Wobble Amplitude"
              max={3}
              min={0}
              onChange={(wobbleAmplitude) => updateEdges({ wobbleAmplitude })}
              step={0.1}
              value={config.edges.wobbleAmplitude}
            />
            <VisualSlider
              decimals={2}
              label="Dormant Alpha"
              max={0.5}
              min={0}
              onChange={(dormantAlpha) => updateEdges({ dormantAlpha })}
              step={0.02}
              value={config.edges.dormantAlpha}
            />
            <VisualSlider
              decimals={2}
              label="Active Alpha"
              max={1}
              min={0.3}
              onChange={(activeAlpha) => updateEdges({ activeAlpha })}
              step={0.05}
              value={config.edges.activeAlpha}
            />
          </VisualSection>

          {/* Colors */}
          <VisualSection
            defaultExpanded={false}
            description="Color theme"
            title="Colors"
          >
            <VisualColorPicker
              label="Primary Color"
              onChange={(primary) => updateColors({ primary })}
              value={config.colors.primary}
            />
            <VisualColorPicker
              label="Secondary Color"
              onChange={(secondary) => updateColors({ secondary })}
              value={config.colors.secondary}
            />
            <VisualColorPicker
              label="Accent Color"
              onChange={(accent) => updateColors({ accent })}
              value={config.colors.accent}
            />
            <VisualColorPicker
              label="Void (Background)"
              onChange={(void_) => updateColors({ void: void_ })}
              value={config.colors.void}
            />
            <VisualColorPicker
              label="Biolum (Glow)"
              onChange={(biolum) => updateColors({ biolum })}
              value={config.colors.biolum}
            />
          </VisualSection>
        </div>
      </div>
    </div>
  );
}
