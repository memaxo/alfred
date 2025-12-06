/**
 * Visual Settings Page
 *
 * User-friendly visual configuration with presets and simplified controls.
 * For full parameter access, use /demo/cortex.
 */

import { PRESET_METADATA } from "@alfred/cortex";
import {
  COLOR_PALETTES,
  type ColorPalette,
  type VisualPreset,
} from "@alfred/type";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ExternalLink, Palette } from "lucide-react";
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

export const Route = createFileRoute("/_protected/settings/visual")({
  component: VisualSettingsPage,
});

function VisualSettingsPage() {
  return (
    <ClientOnly>
      <VisualSettings />
    </ClientOnly>
  );
}

function VisualSettings() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Cortex engine for preview
  const { engine, isReady } = useCortexEngine(canvasRef, {
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
    <div className="container mx-auto max-w-4xl space-y-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            className="mb-2 inline-flex items-center gap-1 text-biolum-dim text-sm transition-colors hover:text-biolum"
            to="/settings"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back to Settings
          </Link>
          <h1 className="font-bold text-3xl text-biolum tracking-tight">
            Visual Appearance
          </h1>
          <p className="text-biolum-dim">
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
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Preview canvas */}
      <div className="relative h-64 overflow-hidden rounded-3xl border border-white/10 bg-void-surface/40">
        <canvas
          className="absolute inset-0 h-full w-full"
          ref={canvasRef}
          style={{ background: "oklch(0.05 0 0)" }}
        />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="animate-pulse text-biolum-dim">
              Loading preview...
            </span>
          </div>
        )}
        <div className="absolute right-3 bottom-3 rounded-full border border-white/10 bg-void-surface/80 px-3 py-1 text-biolum-dim text-xs backdrop-blur-sm">
          Live Preview
        </div>
      </div>

      {/* Presets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-biolum text-xl">
              Quality Presets
            </h2>
            <p className="text-biolum-dim text-sm">
              Choose a preset that matches your hardware capabilities.
            </p>
          </div>
          <Button
            className="rounded-full"
            onClick={reset}
            size="sm"
            variant="ghost"
          >
            Reset to Default
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
          <h2 className="font-semibold text-biolum text-xl">Color Theme</h2>
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
            <h2 className="font-semibold text-biolum text-lg">
              Quick Adjustments
            </h2>
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

      {/* Developer Tools Link */}
      <section className="rounded-2xl border border-white/10 bg-void-surface/40 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-biolum">Advanced Controls</h3>
            <p className="text-biolum-dim text-sm">
              Need more control? Access all visual parameters in the developer
              demo.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-void-surface/50 px-4 py-2 text-biolum-dim text-sm transition-colors hover:border-biolum/30 hover:text-biolum"
            to="/demo/cortex"
          >
            Open Demo
            <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
          </Link>
        </div>
      </section>
    </div>
  );
}
