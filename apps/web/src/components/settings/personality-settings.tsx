"use client";

import { Brain, RefreshCw, Sparkles, Target, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/utils/trpc";

type PersonalitySettingsProps = {
  className?: string;
};

function TraitSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.1,
  description,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-biolum-faint text-xs">{label}</Label>
        <span className="font-mono text-biolum text-xs">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <Slider
        max={max}
        min={min}
        onValueChange={([v]) => onChange(v)}
        step={step}
        value={[value]}
      />
      {description && (
        <p className="text-biolum-faint/60 text-xs">{description}</p>
      )}
    </div>
  );
}

export function PersonalitySettings({ className }: PersonalitySettingsProps) {
  const utils = trpc.useUtils();

  // Queries
  const personalityQuery = trpc.personality.get.useQuery();
  const calibrationQuery = trpc.personality.calibrationStats.useQuery();

  // Mutations
  const updatePersonality = trpc.personality.update.useMutation({
    onSuccess: async () => {
      toast.success("Personality updated");
      await utils.personality.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update personality");
    },
  });

  const resetPersonality = trpc.personality.reset.useMutation({
    onSuccess: async () => {
      toast.success("Personality reset to defaults");
      await utils.personality.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to reset personality");
    },
  });

  const personality = personalityQuery.data;
  const calibration = calibrationQuery.data;

  // Local state for unsaved changes
  const [localChanges, setLocalChanges] = useState<Record<string, unknown>>({});

  const handleTraitChange = (
    category: string,
    trait: string,
    value: number
  ) => {
    setLocalChanges((prev) => ({
      ...prev,
      [category]: {
        ...((prev[category] as Record<string, unknown>) ?? {}),
        [trait]: value,
      },
    }));
  };

  const handleSave = () => {
    updatePersonality.mutate(localChanges as Parameters<typeof updatePersonality.mutate>[0]);
    setLocalChanges({});
  };

  const handleReset = () => {
    if (confirm("Reset all personality traits to defaults?")) {
      resetPersonality.mutate();
      setLocalChanges({});
    }
  };

  const getTraitValue = (
    category: string,
    trait: string,
    defaultValue: number
  ): number => {
    const localCategory = localChanges[category] as
      | Record<string, unknown>
      | undefined;
    if (localCategory?.[trait] !== undefined) {
      return localCategory[trait] as number;
    }
    if (personality) {
      const cat = (personality as Record<string, Record<string, unknown>>)[category];
      if (cat?.[trait] !== undefined) {
        return cat[trait] as number;
      }
    }
    return defaultValue;
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  return (
    <div className={className}>
      {/* Curiosity Traits */}
      <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-biolum text-sm">
          <Sparkles className="h-4 w-4" />
          Curiosity
        </h3>

        <div className="space-y-4">
          <TraitSlider
            description="How often to explore alternative approaches"
            label="Exploration Rate"
            onChange={(v) =>
              handleTraitChange("curiosity", "explorationRate", v)
            }
            value={getTraitValue("curiosity", "explorationRate", 0.3)}
          />
          <TraitSlider
            description="Preference for novel vs. familiar solutions"
            label="Novelty Bias"
            onChange={(v) => handleTraitChange("curiosity", "noveltyBias", v)}
            value={getTraitValue("curiosity", "noveltyBias", 0.5)}
          />
        </div>
      </section>

      {/* Deliberation Traits */}
      <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-biolum text-sm">
          <Brain className="h-4 w-4" />
          Deliberation
        </h3>

        <div className="space-y-4">
          <TraitSlider
            description="How deeply to analyze before acting"
            label="Depth Preference"
            onChange={(v) =>
              handleTraitChange("deliberation", "depthPreference", v)
            }
            value={getTraitValue("deliberation", "depthPreference", 0.6)}
          />
          <TraitSlider
            description="Tolerance for uncertainty in decisions"
            label="Uncertainty Tolerance"
            onChange={(v) =>
              handleTraitChange("deliberation", "uncertaintyTolerance", v)
            }
            value={getTraitValue("deliberation", "uncertaintyTolerance", 0.3)}
          />
        </div>
      </section>

      {/* Aesthetics */}
      <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-biolum text-sm">
          <Zap className="h-4 w-4" />
          Aesthetics
        </h3>

        <div className="space-y-4">
          <div>
            <Label className="text-biolum-faint text-xs">Code Style</Label>
            <Select
              onValueChange={(v) =>
                setLocalChanges((prev) => ({
                  ...prev,
                  aesthetics: {
                    ...((prev.aesthetics as Record<string, unknown>) ?? {}),
                    codeStyle: v,
                  },
                }))
              }
              value={
                (localChanges.aesthetics as Record<string, string>)
                  ?.codeStyle ??
                personality?.aesthetics?.codeStyle ??
                "functional"
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="functional">Functional</SelectItem>
                <SelectItem value="object-oriented">Object-Oriented</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="verbose">Verbose</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TraitSlider
            description="How much detail to include in responses"
            label="Verbosity Level"
            onChange={(v) =>
              handleTraitChange("aesthetics", "verbosityLevel", v)
            }
            value={getTraitValue("aesthetics", "verbosityLevel", 0.5)}
          />

          <TraitSlider
            description="Depth of explanations provided"
            label="Explanation Depth"
            onChange={(v) =>
              handleTraitChange("aesthetics", "explanationDepth", v)
            }
            value={getTraitValue("aesthetics", "explanationDepth", 0.6)}
          />
        </div>
      </section>

      {/* Calibration Stats */}
      {calibration && calibration.overall.totalPredictions > 0 && (
        <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="mb-4 flex items-center gap-2 font-medium text-biolum text-sm">
            <Target className="h-4 w-4" />
            Confidence Calibration
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-biolum-faint text-xs">Total Predictions</p>
              <p className="font-mono text-lg text-white">
                {calibration.overall.totalPredictions}
              </p>
            </div>
            <div>
              <p className="text-biolum-faint text-xs">Accuracy</p>
              <p className="font-mono text-lg text-white">
                {calibration.overall.accuracy !== null
                  ? `${(calibration.overall.accuracy * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
            </div>
          </div>

          {calibration.domains.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-biolum-faint text-xs">By Domain</p>
              <div className="space-y-1">
                {calibration.domains.slice(0, 5).map((domain) => (
                  <div
                    className="flex items-center justify-between text-xs"
                    key={domain.domain}
                  >
                    <span className="text-white">{domain.domain}</span>
                    <span className="font-mono text-biolum">
                      {domain.accuracy !== null
                        ? `${(domain.accuracy * 100).toFixed(0)}%`
                        : "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={!hasChanges || updatePersonality.isPending}
          onClick={handleSave}
        >
          {updatePersonality.isPending ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          disabled={resetPersonality.isPending}
          onClick={handleReset}
          variant="outline"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      {hasChanges && (
        <p className="mt-2 text-center text-biolum-faint text-xs">
          You have unsaved changes
        </p>
      )}
    </div>
  );
}
