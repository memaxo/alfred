/**
 * Visual Settings Section
 *
 * User-friendly visual configuration with presets and simplified controls.
 * Migrated from routes/_protected/settings/visual.tsx
 */

import { PRESET_METADATA } from "@alfred/cortex/presets";
import {
  COLOR_PALETTES,
  type ColorPalette,
  type VisualPreset,
} from "@alfred/type";
import { Check, Palette } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/ai-elements/client-only";
import { Button } from "@/components/ui/button";
import {
  PresetCard,
  PresetGrid,
  VisualSlider,
} from "@/components/visual-config";
import { useCortexEngine } from "@/hooks/use-cortex-engine";
import { useVisualPreferences } from "@/hooks/use-visual-preferences";
import { cn } from "@/lib/utils";

function VisualSettings() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Cortex engine for preview
  const { engine, isReady, capability, error } = useCortexEngine(canvasRef, {
    postProcessing: true,
    autoStart: true,
  });

  // Visual preferences
  const { config, isLoading, isDirty, updateConfig, applyPreset, reset, save } =
    useVisualPreferences({ engine, autoApply: true });

  // Save handler
  const handleSave = useCallback(async () => {
    try {
      await save();
      toast.success("Visual settings saved");
    } catch (_err) {
      toast.error("Failed to save settings");
    }
  }, [save]);

  // Detect current color palette
  const currentPalette = Object.entries(COLOR_PALETTES).find(
    ([, palette]) => palette.primary === config.colors.primary
  )?.[0] as ColorPalette | undefined;

  // Apply color palette
  const applyPalette = useCallback(
    (palette: ColorPalette) => {
      const colors = COLOR_PALETTES[palette];
      updateConfig({ colors, preset: "custom" });
    },
    [updateConfig]
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">Visual & Desktop</h2>
          <p className="text-biolum-dim text-sm">
            Customize Mindscape visual effects and performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-amber-400 text-xs">Unsaved changes</span>
          )}
          <Button
            className="rounded-full"
            disabled={!isDirty || isLoading}
            onClick={handleSave}
            size="sm"
          >
            Save
          </Button>
        </div>
      </div>

      {/* Preview canvas */}
      <div className="relative h-48 overflow-hidden rounded-2xl border border-white/10 bg-void-surface/40">
        <canvas
          className="absolute inset-0 h-full w-full"
          ref={canvasRef}
          style={{ background: "oklch(0.05 0 0)" }}
        />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="animate-pulse text-biolum-dim text-sm">
              Loading preview...
            </span>
          </div>
        )}
        {isReady && !engine && capability !== "webgpu" && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div className="space-y-2">
              <div className="font-semibold text-biolum text-sm">
                WebGPU not available
              </div>
              <div className="text-biolum-dim text-xs">
                Live preview requires WebGPU. Your device reported{" "}
                {capability?.toUpperCase() ?? "UNKNOWN"} support.
              </div>
            </div>
          </div>
        )}
        {isReady &&
          error &&
          (capability === "webgpu" ||
            error.message === "cortex_webgpu_disabled") && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <div className="space-y-2">
                <div className="font-semibold text-biolum text-sm">
                  {error.message === "cortex_webgpu_disabled"
                    ? "WebGPU Disabled"
                    : "Preview failed to initialize"}
                </div>
                <div className="text-biolum-dim text-xs">
                  {error.message === "cortex_webgpu_disabled"
                    ? "WebGPU is disabled in the build configuration."
                    : error.message}
                </div>
              </div>
            </div>
          )}
        <div className="absolute right-3 bottom-3 rounded-full border border-white/10 bg-void-surface/80 px-3 py-1 text-biolum-dim text-xs backdrop-blur-sm">
          Live Preview (WebGPU)
        </div>
      </div>

      {/* Presets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-biolum">Quality Presets</h3>
            <p className="text-biolum-dim text-sm">
              Choose a preset that matches your hardware capabilities.
            </p>
          </div>
          <Button onClick={reset} size="sm" variant="ghost">
            Reset
          </Button>
        </div>

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
      </section>

      {/* Color Palette */}
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold text-biolum">Color Theme</h3>
          <p className="text-biolum-dim text-sm">
            Select a color palette for the visual effects.
          </p>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {(Object.keys(COLOR_PALETTES) as ColorPalette[]).map((palette) => {
            const colors = COLOR_PALETTES[palette];
            const isSelected = currentPalette === palette;

            return (
              <button
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                  "hover:border-biolum/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum/50",
                  isSelected
                    ? "border-biolum/50 bg-biolum/10"
                    : "border-white/10 bg-void-surface/40"
                )}
                key={palette}
                onClick={() => applyPalette(palette)}
                type="button"
              >
                {/* Color swatches */}
                <div className="flex items-center gap-1">
                  <div
                    className="h-6 w-6 rounded-full border border-white/20"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <div
                    className="h-5 w-5 rounded-full border border-white/20"
                    style={{ backgroundColor: colors.secondary }}
                  />
                  <div
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ backgroundColor: colors.accent }}
                  />
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-xs capitalize transition-colors",
                    isSelected ? "text-biolum" : "text-biolum-dim"
                  )}
                >
                  {palette}
                </span>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-biolum">
                    <Check className="h-2.5 w-2.5 text-void" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick Adjustments */}
      {config.preset === "custom" && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-void-surface/40 p-6">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-biolum-dim" strokeWidth={1.5} />
            <h3 className="font-semibold text-biolum">Quick Adjustments</h3>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <VisualSlider
              description="More particles = more GPU usage"
              label="Particle Density"
              max={8000}
              min={500}
              onChange={(count) => updateConfig({ particles: { count } })}
              step={500}
              value={config.particles.count}
            />

            <VisualSlider
              decimals={1}
              description="Node glow brightness"
              label="Glow Intensity"
              max={1}
              min={0}
              onChange={(glowIntensity) =>
                updateConfig({ nodes: { glowIntensity } })
              }
              step={0.1}
              value={config.nodes.glowIntensity}
            />

            <VisualSlider
              decimals={1}
              description="Post-processing bloom"
              label="Bloom Effect"
              max={1}
              min={0}
              onChange={(intensity) => updateConfig({ bloom: { intensity } })}
              step={0.1}
              value={config.bloom.intensity}
            />

            <VisualSlider
              description="Central orb corona radius"
              label="Corona Size"
              max={600}
              min={200}
              onChange={(outerRadius) =>
                updateConfig({ corona: { outerRadius } })
              }
              step={50}
              unit="px"
              value={config.corona.outerRadius}
            />
          </div>
        </section>
      )}
    </div>
  );
}

export function VisualSection() {
  return (
    <ClientOnly>
      <VisualSettings />
    </ClientOnly>
  );
}
