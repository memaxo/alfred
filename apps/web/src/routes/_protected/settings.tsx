import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Palette, Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/settings")({
  component: SettingsRoute,
});

type SettingsLinkProps = {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

function SettingsLink({ to, icon, title, description }: SettingsLinkProps) {
  return (
    <Link
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-colors",
        "hover:border-biolum/30 hover:bg-biolum/5",
        "border-white/10 bg-void-surface/40"
      )}
      to={to}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-biolum/10 text-biolum">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-biolum">{title}</h3>
        <p className="text-biolum-dim text-sm">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-biolum-faint" strokeWidth={1.5} />
    </Link>
  );
}

function SettingsRoute() {
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

  return (
    <div className="container mx-auto max-w-2xl space-y-8 py-10">
      <div>
        <h1 className="font-bold text-3xl text-biolum tracking-tight">
          Settings
        </h1>
        <p className="text-biolum-dim">
          Manage your voice and application preferences.
        </p>
      </div>

      {/* Quick Navigation */}
      <div className="space-y-3">
        <SettingsLink
          description="Customize Mindscape visual effects and performance"
          icon={<Palette className="h-5 w-5" strokeWidth={1.5} />}
          title="Visual Appearance"
          to="/settings/visual"
        />
      </div>

      {/* Voice Settings */}
      <div className="space-y-4 rounded-xl border border-white/10 bg-void-surface/40 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-biolum/10 text-biolum">
            <Volume2 className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-semibold text-biolum text-xl">Voice</h2>
            <p className="text-biolum-dim text-sm">
              Choose the voice Alfred uses for speech-to-speech responses.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {voices?.map((voice) => (
            <div
              className={cn(
                "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors",
                currentVoice === voice.id
                  ? "border-biolum/50 bg-biolum/10"
                  : "border-white/10 hover:border-biolum/30 hover:bg-biolum/5"
              )}
              key={voice.id}
              onClick={() => handleVoiceChange(voice.id)}
            >
              <div className="font-medium text-biolum">{voice.name}</div>
              <div className="text-biolum-faint text-xs">ID: {voice.id}</div>
              {currentVoice === voice.id && (
                <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-biolum" />
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4">
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
            {previewVoice.isPending ? "Generating..." : "Preview"}
          </Button>
        </div>
      </div>
    </div>
  );
}
