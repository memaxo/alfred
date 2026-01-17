import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../utils/trpc";

export const Route = createFileRoute("/_protected/settings/models")({
  component: ModelSettings,
});

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

function ModelSettings() {
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
        scope: "user",
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
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="font-bold text-2xl">Model Configuration</h1>
        <p className="text-muted-foreground">
          Configure which AI models ALFRED uses for different roles. Changes
          take effect immediately.
        </p>
      </div>

      <div className="space-y-4">
        {configs.map((config) => (
          <div className="space-y-4 rounded-lg border p-4" key={config.role}>
            <div>
              <h3 className="font-semibold capitalize">{config.role}</h3>
              <p className="text-muted-foreground text-sm">
                {getRoleDescription(config.role)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="mb-1 block font-medium text-sm"
                  htmlFor={`provider-${config.role}`}
                >
                  Provider
                </label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  id={`provider-${config.role}`}
                  onChange={(e) =>
                    updateConfig(config.role, "provider", e.target.value)
                  }
                  value={config.provider}
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-1 block font-medium text-sm"
                  htmlFor={`modelId-${config.role}`}
                >
                  Model ID
                </label>
                <input
                  className="w-full rounded-md border px-3 py-2"
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

            <div className="text-muted-foreground text-xs">
              Model Ref:{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                {config.provider}:{config.modelId}
              </code>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          className="rounded-md border px-4 py-2 hover:bg-muted"
          onClick={() => window.location.reload()}
          type="button"
        >
          Reset
        </button>
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={setPreferenceMutation.isPending}
          onClick={handleSave}
          type="button"
        >
          {setPreferenceMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {setPreferenceMutation.isSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-800">
          Model preferences saved successfully!
        </div>
      )}

      {setPreferenceMutation.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          Error saving preferences: {setPreferenceMutation.error.message}
        </div>
      )}
    </div>
  );
}

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
