import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const [previewText, setPreviewText] = useState("Hello, I am Alfred.");
  const utils = trpc.useUtils();
  
  const { data: voices } = trpc.voice.listVoices.useQuery();
  const { data: prefs } = trpc.user.getPreferences.useQuery();
  
  const currentVoice = prefs?.find((p) => p.key === "voice.tts")?.value as string | undefined;
  
  const setPreference = trpc.user.setPreference.useMutation({
    onSuccess: () => {
      toast.success("Voice updated");
      utils.user.getPreferences.invalidate();
    },
  });

  const previewVoice = trpc.voice.previewVoice.useMutation({
    onSuccess: (result) => {
      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      audio.play();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleVoiceChange = (voiceId: string) => {
    setPreference.mutate({
      key: "voice.tts",
      value: voiceId,
    });
  };

  return (
    <div className="container mx-auto max-w-2xl py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your voice and application preferences.</p>
      </div>

      <div className="space-y-4 rounded-xl border p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Voice</h2>
          <p className="text-sm text-muted-foreground">
            Choose the voice Alfred uses for speech-to-speech responses.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {voices?.map((voice) => (
            <div
              key={voice.id}
              className={`relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 hover:bg-accent ${
                currentVoice === voice.id ? "border-primary bg-accent" : ""
              }`}
              onClick={() => handleVoiceChange(voice.id)}
            >
              <div className="font-medium">{voice.name}</div>
              <div className="text-xs text-muted-foreground">ID: {voice.id}</div>
              {currentVoice === voice.id && (
                <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4">
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Type something to preview..."
          />
          <Button
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
