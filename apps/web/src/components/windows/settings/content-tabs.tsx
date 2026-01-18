/**
 * Unified Settings Content Component with Tabs
 *
 * Shared settings UI that can be used in both route and window contexts.
 * Organizes voice, autonomy, and preferences into tabbed sections.
 */

import type { inferRouterInputs } from "@trpc/server";
import { Trash2, User, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type AutonomyLevel,
  AutonomySlider,
} from "@/components/autonomy-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppForm, useSubmitInvalidFocus } from "@/form";
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
    <div className={cn("space-y-4 py-4", isCompact ? "px-4" : "px-6")}>
      <div className="space-y-4">
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
          {previewVoice.isPending ? "..." : "Preview Voice"}
        </Button>
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
              "p-3",
              currentVoice === voice.id
                ? "border-biolum/50 bg-biolum/10"
                : "border-white/10 hover:border-biolum/30 hover:bg-biolum/5"
            )}
            key={voice.id}
            onClick={() => handleVoiceChange(voice.id)}
          >
            <div className="font-medium text-biolum text-sm">{voice.name}</div>
            {!isCompact && (
              <div className="text-biolum-faint text-xs">ID: {voice.id}</div>
            )}
            {currentVoice === voice.id && (
              <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-biolum" />
            )}
          </div>
        ))}
      </div>
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
    <div className={cn("py-4", isCompact ? "px-4" : "px-6")}>
      <p className="mb-4 text-biolum-dim text-sm">
        Control Alfred's autonomy level for autonomous actions.
      </p>
      <AutonomySlider onChange={handleAutonomyChange} value={currentAutonomy} />
    </div>
  );
}

function PreferencesSection({ mode }: { mode: SettingsMode }) {
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

  const { ref, onSubmitInvalid } = useSubmitInvalidFocus();
  const form = useAppForm({
    defaultValues: {
      prefKey: "",
      prefValue: "",
    },
  });

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
    <div className={cn("space-y-4 py-4", isCompact ? "px-4" : "px-6")}>
      <form.AppForm>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const keyEl = event.currentTarget.elements.namedItem("prefKey");
            const valueEl = event.currentTarget.elements.namedItem("prefValue");
            const rawKey =
              keyEl && typeof (keyEl as { value?: unknown }).value === "string"
                ? (keyEl as { value: string }).value
                : "";
            const rawValue =
              valueEl &&
              typeof (valueEl as { value?: unknown }).value === "string"
                ? (valueEl as { value: string }).value
                : "";

            const trimmedKey = rawKey.trim();
            const trimmedValue = rawValue.trim();

            if (!trimmedKey) {
              onSubmitInvalid();
              toast.error("Preference key required");
              return;
            }
            if (!trimmedValue) {
              onSubmitInvalid();
              toast.error("Preference value required");
              return;
            }

            let parsedValue: unknown = trimmedValue;
            try {
              parsedValue = JSON.parse(trimmedValue);
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
                form.reset();
              },
            });
          }}
          ref={ref}
        >
          <form.AppField name="prefKey">
            {(field) => (
              <Input
                aria-invalid={field.state.meta.errors.length > 0}
                className="bg-void-surface/50"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="key (e.g. theme)"
                value={field.state.value}
              />
            )}
          </form.AppField>
          <form.AppField name="prefValue">
            {(field) => (
              <Textarea
                aria-invalid={field.state.meta.errors.length > 0}
                className={cn(
                  "bg-void-surface/50",
                  isCompact ? "min-h-[40px]" : "min-h-[60px]"
                )}
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="value (string or JSON)"
                value={field.state.value}
              />
            )}
          </form.AppField>
          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ isSubmitting }) => (
              <Button
                className="self-end"
                disabled={setPreference.isPending || isSubmitting}
                size="sm"
                type="submit"
              >
                Save
              </Button>
            )}
          </form.Subscribe>
        </form>
      </form.AppForm>

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
    </div>
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
      <Tabs className="w-full" defaultValue="voice">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="voice">
            <Volume2 className="mr-2 h-4 w-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="autonomy">Autonomy</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          {onNavigate && !isCompact && (
            <TabsTrigger
              onClick={() => onNavigate("/settings/profile")}
              value="profile"
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="voice">
          <VoiceSection mode={mode} />
        </TabsContent>
        <TabsContent value="autonomy">
          <AutonomySection mode={mode} />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesSection mode={mode} />
        </TabsContent>
        {onNavigate && !isCompact && (
          <TabsContent value="profile">
            <div className="px-6 py-4">
              <p className="text-biolum-dim">
                Profile settings are in navigation.
              </p>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
