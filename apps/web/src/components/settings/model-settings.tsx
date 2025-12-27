"use client";

import { Bot, Check, Cpu, Loader2, Zap } from "lucide-react";
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
import { trpc } from "@/utils/trpc";

interface ModelSettingsProps {
  className?: string;
}

type ModelRole =
  | "chat"
  | "orchestrator"
  | "planner"
  | "background"
  | "voice"
  | "fast";

const ROLE_DESCRIPTIONS: Record<ModelRole, string> = {
  chat: "Conversational responses and general assistance",
  orchestrator: "Complex multi-step workflows and task coordination",
  planner: "Strategic planning and decision making",
  background: "Idle-time tasks and background processing",
  voice: "Voice interaction and real-time speech",
  fast: "Quick logic operations requiring low latency",
};

const AVAILABLE_MODELS = [
  // Cerebras (fast)
  {
    value: "cerebras:llama3.1-8b",
    label: "Cerebras Llama 3.1 8B",
    provider: "cerebras",
  },
  {
    value: "cerebras:llama3.1-70b",
    label: "Cerebras Llama 3.1 70B",
    provider: "cerebras",
  },
  {
    value: "cerebras:llama-3.3-70b",
    label: "Cerebras Llama 3.3 70B",
    provider: "cerebras",
  },

  // OpenRouter - Anthropic
  {
    value: "openrouter:anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "openrouter",
  },
  {
    value: "openrouter:anthropic/claude-3-haiku",
    label: "Claude 3 Haiku",
    provider: "openrouter",
  },

  // OpenRouter - OpenAI
  {
    value: "openrouter:openai/gpt-4o",
    label: "GPT-4o",
    provider: "openrouter",
  },
  {
    value: "openrouter:openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "openrouter",
  },

  // OpenRouter - Google
  {
    value: "openrouter:google/gemini-flash-1.5",
    label: "Gemini Flash 1.5",
    provider: "openrouter",
  },
  {
    value: "openrouter:google/gemini-pro-1.5",
    label: "Gemini Pro 1.5",
    provider: "openrouter",
  },

  // OpenRouter - Meta
  {
    value: "openrouter:meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    provider: "openrouter",
  },

  // Gateway (default)
  {
    value: "gateway:openai/gpt-4o",
    label: "Gateway GPT-4o",
    provider: "gateway",
  },
  {
    value: "gateway:openai/gpt-4o-mini",
    label: "Gateway GPT-4o Mini",
    provider: "gateway",
  },
];

const RECOMMENDED_MODELS: Record<ModelRole, string[]> = {
  chat: [
    "cerebras:llama3.1-70b",
    "openrouter:anthropic/claude-3.5-sonnet",
    "openrouter:openai/gpt-4o",
  ],
  orchestrator: [
    "openrouter:anthropic/claude-3.5-sonnet",
    "openrouter:openai/gpt-4o",
  ],
  planner: [
    "openrouter:anthropic/claude-3.5-sonnet",
    "openrouter:openai/gpt-4o",
  ],
  background: ["cerebras:llama3.1-8b", "openrouter:google/gemini-flash-1.5"],
  voice: ["cerebras:llama3.1-8b", "openrouter:openai/gpt-4o-mini"],
  fast: ["cerebras:llama3.1-8b", "cerebras:llama3.1-70b"],
};

function RoleModelSelector({
  role,
  currentModel,
  onChange,
  disabled,
}: {
  role: ModelRole;
  currentModel: string | null;
  onChange: (model: string) => void;
  disabled?: boolean;
}) {
  const recommended = RECOMMENDED_MODELS[role];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-biolum text-sm capitalize">{role}</Label>
        <span className="text-biolum-faint text-xs">
          {ROLE_DESCRIPTIONS[role]}
        </span>
      </div>
      <Select
        disabled={disabled}
        onValueChange={onChange}
        value={currentModel ?? ""}
      >
        <SelectTrigger>
          <SelectValue placeholder="Use default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Use default</SelectItem>
          {AVAILABLE_MODELS.map((model) => {
            const isRecommended = recommended.includes(model.value);
            return (
              <SelectItem key={model.value} value={model.value}>
                <div className="flex items-center gap-2">
                  {model.provider === "cerebras" ? (
                    <Zap className="h-3 w-3 text-yellow-400" />
                  ) : (
                    <Bot className="h-3 w-3 text-blue-400" />
                  )}
                  <span>{model.label}</span>
                  {isRecommended && (
                    <Check className="h-3 w-3 text-green-400" />
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ModelSettings({ className }: ModelSettingsProps) {
  const utils = trpc.useUtils();

  // Query budget settings (which includes model preferences)
  const budgetQuery = trpc.budget.get.useQuery();

  // Mutation
  const setBudget = trpc.budget.set.useMutation({
    onSuccess: async () => {
      toast.success("Model preferences saved");
      await utils.budget.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to save model preferences");
    },
  });

  const currentPreferences = budgetQuery.data?.modelPreferences ?? {};
  const [localPreferences, setLocalPreferences] = useState<
    Record<string, string>
  >({});

  const getModel = (role: ModelRole): string | null => {
    if (localPreferences[role] !== undefined) {
      return localPreferences[role] || null;
    }
    return currentPreferences[role] ?? null;
  };

  const handleModelChange = (role: ModelRole, model: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [role]: model,
    }));
  };

  const handleSave = () => {
    const merged = { ...currentPreferences };
    for (const [role, model] of Object.entries(localPreferences)) {
      if (model) {
        (merged as Record<string, string>)[role] = model;
      } else {
        delete (merged as Record<string, string>)[role];
      }
    }

    setBudget.mutate({
      modelPreferences: Object.keys(merged).length > 0 ? merged : undefined,
    });
    setLocalPreferences({});
  };

  const hasChanges = Object.keys(localPreferences).length > 0;
  const roles: ModelRole[] = [
    "chat",
    "orchestrator",
    "planner",
    "background",
    "voice",
    "fast",
  ];

  return (
    <div className={className}>
      <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-biolum text-sm">
          <Cpu className="h-4 w-4" />
          Model Preferences by Role
        </h3>

        <div className="space-y-4">
          {roles.map((role) => (
            <RoleModelSelector
              currentModel={getModel(role)}
              disabled={setBudget.isPending}
              key={role}
              onChange={(model) => handleModelChange(role, model)}
              role={role}
            />
          ))}
        </div>

        <div className="mt-4 rounded bg-white/5 p-3">
          <p className="mb-2 font-medium text-biolum text-xs">
            Provider Legend
          </p>
          <div className="flex items-center gap-4 text-biolum-faint text-xs">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-400" />
              Cerebras (ultra-fast)
            </span>
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3 text-blue-400" />
              OpenRouter
            </span>
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-green-400" />
              Recommended
            </span>
          </div>
        </div>
      </section>

      <Button
        className="w-full"
        disabled={!hasChanges || setBudget.isPending}
        onClick={handleSave}
      >
        {setBudget.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Model Preferences"
        )}
      </Button>

      {hasChanges && (
        <p className="mt-2 text-center text-biolum-faint text-xs">
          You have unsaved changes
        </p>
      )}
    </div>
  );
}
