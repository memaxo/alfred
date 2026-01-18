/**
 * Models Settings Section
 *
 * Configure which AI models ALFRED uses for different roles.
 * Migrated from routes/_protected/settings/models.tsx
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";

const MODEL_ROLES = [
  "chat",
  "orchestrator",
  "planner",
  "background",
  "voice",
] as const;
const PROVIDERS = [
  "openai",
  "cerebras",
  "openrouter",
  "anthropic",
  "google",
] as const;

type ModelRole = (typeof MODEL_ROLES)[number];
type Provider = (typeof PROVIDERS)[number];

type ModelConfig = {
  role: ModelRole;
  provider: Provider;
  modelId: string;
};

function getRoleDescription(role: ModelRole): string {
  switch (role) {
    case "chat":
      return "Used for conversational interactions and general assistance";
    case "orchestrator":
      return "Used for workflow orchestration and multi-agent coordination";
    case "planner":
      return "Used for task decomposition and execution planning";
    case "background":
      return "Used for background processing and pattern extraction";
    case "voice":
      return "Used for voice interactions and speech-to-speech responses";
  }
}

export function ModelsSection() {
  const [configs, setConfigs] = useState<ModelConfig[]>(
    MODEL_ROLES.map((role) => ({
      role,
      provider: "openai" as Provider,
      modelId: "gpt-4o-mini",
    }))
  );

  const setPreferenceMutation = trpc.preference.set.useMutation();

  const handleSave = async () => {
    for (const config of configs) {
      const modelRef = `${config.provider}:${config.modelId}`;
      await setPreferenceMutation.mutateAsync({
        key: `domain.ai.model.${config.role}`,
        value: modelRef,
      });
    }
  };

  const updateConfig = (
    role: ModelRole,
    field: keyof ModelConfig,
    value: string
  ) => {
    setConfigs((prev) =>
      prev.map((c) => (c.role === role ? { ...c, [field]: value } : c))
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="font-semibold text-lg">AI Models</h2>
        <p className="text-biolum-dim text-sm">
          Configure which AI models ALFRED uses for different roles. Changes
          take effect immediately.
        </p>
      </div>

      {/* Model Configurations */}
      <div className="space-y-4">
        {configs.map((config) => (
          <div
            className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4"
            key={config.role}
          >
            <div>
              <h3 className="font-semibold capitalize">{config.role}</h3>
              <p className="text-biolum-dim text-sm">
                {getRoleDescription(config.role)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label
                  className="mb-1 block font-medium text-sm"
                  htmlFor={`provider-${config.role}`}
                >
                  Provider
                </Label>
                <Select
                  onValueChange={(value) =>
                    updateConfig(config.role, "provider", value)
                  }
                  value={config.provider}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  className="mb-1 block font-medium text-sm"
                  htmlFor={`modelId-${config.role}`}
                >
                  Model ID
                </Label>
                <Input
                  id={`modelId-${config.role}`}
                  onChange={(e) =>
                    updateConfig(config.role, "modelId", e.target.value)
                  }
                  placeholder="e.g., gpt-4o-mini"
                  type="text"
                  value={config.modelId}
                />
              </div>
            </div>

            <div className="text-biolum-dim text-xs">
              Model Ref:{" "}
              <code className="rounded bg-void px-1 py-0.5">
                {config.provider}:{config.modelId}
              </code>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-3">
        <Button
          className="rounded-full"
          onClick={() => window.location.reload()}
          size="sm"
          type="button"
          variant="outline"
        >
          Reset
        </Button>
        <Button
          className="rounded-full"
          disabled={setPreferenceMutation.isPending}
          onClick={handleSave}
          type="button"
        >
          {setPreferenceMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {setPreferenceMutation.isSuccess && (
        <div className="rounded-md border border-green-500/50 bg-green-500/10 p-4 text-green-400 text-sm">
          Model preferences saved successfully!
        </div>
      )}

      {setPreferenceMutation.isError && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-4 text-red-400 text-sm">
          Error saving preferences: {setPreferenceMutation.error.message}
        </div>
      )}
    </div>
  );
}
