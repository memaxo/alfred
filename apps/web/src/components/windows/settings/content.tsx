/**
 * Unified Settings Content Component
 *
 * Shared settings UI that can be used in both route and window contexts.
 * Consolidates voice, autonomy, preferences, and navigation settings.
 */

import type { inferRouterInputs } from "@trpc/server";
import {
  ChevronRight,
  Palette,
  Shield,
  Trash2,
  User,
  Volume2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type AutonomyLevel,
  AutonomySlider,
} from "@/components/autonomy-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

type PreferenceSetInput = inferRouterInputs<TRPCAppRouter>["preference"]["set"];
type PreferenceDeleteInput =
  inferRouterInputs<TRPCAppRouter>["preference"]["delete"];

export type SettingsMode = "full" | "compact";

export type SettingsContentProps = {
  mode?: SettingsMode;
  onNavigate?: (path: string) => void;
  className?: string;
};

const listInput = { limit: 100, offset: 0 } as const;

type SettingsLinkProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
};

function SettingsLink({
  icon,
  title,
  description,
  onClick,
}: SettingsLinkProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
        "hover:border-biolum/30 hover:bg-biolum/5",
        "border-white/10 bg-void-surface/40"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-biolum/10 text-biolum">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-biolum">{title}</h3>
        <p className="truncate text-biolum-dim text-sm">{description}</p>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-biolum-faint"
        strokeWidth={1.5}
      />
    </button>
  );
}

function VoiceSection({ mode }: { mode: SettingsMode }) {
  const [previewText, setPreviewText] = useState("Hello, I am Alfred.");
  const utils = trpc.useUtils();

  const { data: voices } = trpc.voice.listVoices.useQuery();
  const { data: prefs } = trpc.user.getPreferences.useQuery();

  const currentVoice = prefs?.find((p) => p.key === "voice.tts")?.value as
    | string
    | undefined;

  const setPreference = trpc.user.setPreference.useMutation({
    onSuccess: () => {
      toast.success("Voice updated");
      utils.user.getPreferences.invalidate();
    },
  });

  const previewVoice = trpc.voice.previewVoice.useMutation({
    onSuccess: (result) => {
      const audio = new Audio(
        `data:${result.mimeType};base64,${result.audioBase64}`
      );
      audio.play();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleVoiceChange = (voiceId: string) => {
    setPreference.mutate({
      key: "voice.tts",
      value: voiceId,
    });
  };

  const isCompact = mode === "compact";

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-white/10 bg-void-surface/40",
        isCompact ? "p-4" : "p-6"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-biolum/10 text-biolum",
            isCompact ? "h-8 w-8" : "h-10 w-10"
          )}
        >
          <Volume2
            className={isCompact ? "h-4 w-4" : "h-5 w-5"}
            strokeWidth={1.5}
          />
        </div>
        <div>
          <h2
            className={cn(
              "font-semibold text-biolum",
              isCompact ? "text-sm" : "text-xl"
            )}
          >
            Voice
          </h2>
          {!isCompact && (
            <p className="text-biolum-dim text-sm">
              Choose the voice Alfred uses for speech-to-speech responses.
            </p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3",
          isCompact ? "grid-cols-1" : "sm:grid-cols-2"
        )}
      >
        {voices?.slice(0, isCompact ? 4 : undefined).map((voice) => (
          <div
            className={cn(
              "relative flex cursor-pointer flex-col gap-1 rounded-xl border transition-colors",
              isCompact ? "p-3" : "p-4",
              currentVoice === voice.id
                ? "border-biolum/50 bg-biolum/10"
                : "border-white/10 hover:border-biolum/30 hover:bg-biolum/5"
            )}
            key={voice.id}
            onClick={() => handleVoiceChange(voice.id)}
          >
            <div
              className={cn("font-medium text-biolum", isCompact && "text-sm")}
            >
              {voice.name}
            </div>
            {!isCompact && (
              <div className="text-biolum-faint text-xs">ID: {voice.id}</div>
            )}
            {currentVoice === voice.id && (
              <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-biolum" />
            )}
          </div>
        ))}
      </div>

      {!isCompact && (
        <div className="flex gap-2 pt-2">
          <input
            className={cn(
              "flex h-10 w-full rounded-full border px-4 py-2 text-sm",
              "border-white/10 bg-void-surface/50 text-biolum",
              "placeholder:text-biolum-faint",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum/50"
            )}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Type something to preview..."
            value={previewText}
          />
          <Button
            className="rounded-full"
            disabled={!currentVoice || previewVoice.isPending}
            onClick={() => {
              if (currentVoice) {
                previewVoice.mutate({ voice: currentVoice, text: previewText });
              }
            }}
          >
            {previewVoice.isPending ? "..." : "Preview"}
          </Button>
        </div>
      )}
    </div>
  );
}

function AutonomySection({ mode }: { mode: SettingsMode }) {
  const utils = trpc.useUtils();
  const preferenceQuery = trpc.preference.list.useQuery(listInput);
  const preferences = preferenceQuery.data ?? [];

  const autonomyPreference = useMemo(
    () => preferences.find((pref) => pref.key === "autonomy"),
    [preferences]
  );

  const currentAutonomy: AutonomyLevel =
    (autonomyPreference?.value as AutonomyLevel) ?? "low";

  const setPreference = trpc.preference.set.useMutation({
    onSuccess: async () => {
      toast.success("Autonomy level updated");
      await utils.preference.list.invalidate(listInput);
    },
    onError: (error) => {
      toast.error(error.message ?? "autonomy_update_failed");
    },
  });

  const handleAutonomyChange = (level: AutonomyLevel) => {
    const input: PreferenceSetInput = {
      key: "autonomy",
      value: level,
      confidence: 1,
    };
    setPreference.mutate(input);
  };

  const isCompact = mode === "compact";

  return (
    <section
      className={cn(
        "rounded-xl border border-white/10 bg-void-surface/40",
        isCompact ? "p-4" : "p-6"
      )}
    >
      <h3
        className={cn(
          "mb-3 font-semibold text-biolum",
          isCompact ? "text-sm" : "text-lg"
        )}
      >
        Autonomy Level
      </h3>
      <AutonomySlider onChange={handleAutonomyChange} value={currentAutonomy} />
    </section>
  );
}

function PreferencesSection({ mode }: { mode: SettingsMode }) {
  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");

  const utils = trpc.useUtils();
  const preferenceQuery = trpc.preference.list.useQuery(listInput);
  const preferences = preferenceQuery.data ?? [];

  const setPreference = trpc.preference.set.useMutation({
    onSuccess: async () => {
      toast.success("Preference saved");
      await utils.preference.list.invalidate(listInput);
    },
    onError: (error) => {
      toast.error(error.message ?? "preference_update_failed");
    },
  });

  const deletePreference = trpc.preference.delete.useMutation({
    onSuccess: async () => {
      toast.success("Preference removed");
      await utils.preference.list.invalidate(listInput);
    },
    onError: (error) => {
      toast.error(error.message ?? "preference_delete_failed");
    },
  });

  const handleCustomSave = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedKey = customKey.trim();
    if (!trimmedKey) {
      toast.error("Preference key required");
      return;
    }
    if (!customValue.trim()) {
      toast.error("Preference value required");
      return;
    }

    let parsedValue: unknown = customValue.trim();
    try {
      parsedValue = JSON.parse(customValue);
    } catch {
      // keep string
    }

    const input: PreferenceSetInput = {
      key: trimmedKey,
      value: parsedValue,
      confidence: 1,
    };

    setPreference.mutate(input, {
      onSuccess: () => {
        setCustomKey("");
        setCustomValue("");
      },
    });
  };

  const handleDelete = (key: string) => {
    const input: PreferenceDeleteInput = { key };
    deletePreference.mutate(input);
  };

  const isCompact = mode === "compact";
  const preferenceItems = useMemo(
    () =>
      preferences
        .filter((p) => p.key !== "autonomy")
        .slice(0, isCompact ? 5 : 10),
    [preferences, isCompact]
  );

  return (
    <section
      className={cn(
        "rounded-xl border border-white/10 bg-void-surface/40",
        isCompact ? "p-4" : "p-6"
      )}
    >
      <h3
        className={cn(
          "mb-3 font-semibold text-biolum",
          isCompact ? "text-sm" : "text-lg"
        )}
      >
        Custom Preferences
      </h3>

      <form className="mb-4 flex flex-col gap-2" onSubmit={handleCustomSave}>
        <Input
          className="bg-void-surface/50"
          onChange={(e) => setCustomKey(e.target.value)}
          placeholder="key (e.g. theme)"
          value={customKey}
        />
        <Textarea
          className={cn(
            "bg-void-surface/50",
            isCompact ? "min-h-[40px]" : "min-h-[60px]"
          )}
          onChange={(e) => setCustomValue(e.target.value)}
          placeholder="value (string or JSON)"
          value={customValue}
        />
        <Button
          className="self-end"
          disabled={setPreference.isPending}
          size="sm"
          type="submit"
        >
          Save
        </Button>
      </form>

      <div className="space-y-1">
        <h4 className="text-biolum-dim text-xs">
          Saved ({preferences.length})
        </h4>
        <ScrollArea className={isCompact ? "h-[100px]" : "h-[160px]"}>
          {preferenceItems.length === 0 ? (
            <p className="py-4 text-center text-biolum-faint text-xs">
              No custom preferences
            </p>
          ) : (
            <ul className="space-y-1">
              {preferenceItems.map((pref) => (
                <li
                  className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1 text-xs"
                  key={pref.key}
                >
                  <span className="font-medium text-white">{pref.key}</span>
                  <span className="max-w-[100px] truncate text-biolum-faint">
                    {typeof pref.value === "string"
                      ? pref.value
                      : JSON.stringify(pref.value)}
                  </span>
                  <Button
                    disabled={deletePreference.isPending}
                    onClick={() => handleDelete(pref.key)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </section>
  );
}

export function SettingsContent({
  mode = "full",
  onNavigate,
  className,
}: SettingsContentProps) {
  const isCompact = mode === "compact";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {!isCompact && onNavigate && (
        <div className="space-y-3">
          <SettingsLink
            description="Manage your personal information and profile"
            icon={<User className="h-5 w-5" strokeWidth={1.5} />}
            onClick={() => onNavigate("/settings/profile")}
            title="Profile"
          />
          <SettingsLink
            description="Customize Mindscape visual effects and performance"
            icon={<Palette className="h-5 w-5" strokeWidth={1.5} />}
            onClick={() => onNavigate("/settings/visual")}
            title="Visual Appearance"
          />
          <SettingsLink
            description="Manage your data privacy and autonomy levels"
            icon={<Shield className="h-5 w-5" strokeWidth={1.5} />}
            onClick={() => onNavigate("/settings/privacy")}
            title="Privacy"
          />
        </div>
      )}

      <AutonomySection mode={mode} />
      <VoiceSection mode={mode} />
      <PreferencesSection mode={mode} />
    </div>
  );
}
