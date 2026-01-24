import { useCallback, useEffect, useRef } from "react";

import { trpc } from "@/utils/trpc";

type JarvisSpeakOptions = {
  preface?: "auto" | "greeting" | "ack" | "none";
  voice?: string;
  format?: "mp3" | "opus" | "wav";
};

type JarvisTtsConfig = {
  enabled?: boolean;
  defaultVoice?: string;
  defaultFormat?: "mp3" | "opus" | "wav";
};

const ACKS = [
  "Understood, Sir.",
  "Right away, Sir.",
  "Very good, Sir.",
  "On it, Sir.",
] as const;

function getTimeGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return "Good morning, Sir.";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon, Sir.";
  }
  if (hour >= 17 && hour < 22) {
    return "Good evening, Sir.";
  }
  return "Still at it, Sir?";
}

function chooseAck(seed: number): string {
  const idx = Math.abs(seed) % ACKS.length;
  return ACKS[idx] ?? ACKS[0];
}

function joinPreface(preface: string, text: string): string {
  const p = preface.trim();
  const t = text.trim();
  if (!p) {
    return t;
  }
  if (!t) {
    return p;
  }
  const lp = p.toLowerCase();
  const lt = t.toLowerCase();
  if (lt.startsWith(lp)) {
    return text.trim();
  }
  return `${p} ${t}`.trim();
}

export function useJarvisTts(config: JarvisTtsConfig = {}) {
  const {
    enabled = false,
    defaultVoice = "alloy",
    defaultFormat = "mp3",
  } = config;

  const tts = trpc.voice.ttsSynthesize.useMutation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greetedRef = useRef(false);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    try {
      audio.pause();
    } catch {
      // ignore
    }
    audio.src = "";
    audioRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const speak = useCallback(
    async (text: string, opts: JarvisSpeakOptions = {}) => {
      if (!enabled) {
        return;
      }

      const prefaceMode = opts.preface ?? "auto";
      const hour = new Date().getHours();
      const seed = Math.floor(Date.now() / 1000);

      let preface = "";
      if (
        prefaceMode === "greeting" ||
        (prefaceMode === "auto" && !greetedRef.current)
      ) {
        preface = getTimeGreeting(hour);
        greetedRef.current = true;
      } else if (prefaceMode === "ack" || prefaceMode === "auto") {
        preface = chooseAck(seed);
      }

      const finalText = joinPreface(preface, text);
      const voice = opts.voice ?? defaultVoice;
      const format = opts.format ?? defaultFormat;

      const audio = await tts.mutateAsync({ text: finalText, voice, format });
      if (!audio?.audioBase64) {
        return;
      }

      stop();
      const src = `data:${audio.mimeType};base64,${audio.audioBase64}`;
      const el = new Audio(src);
      audioRef.current = el;
      try {
        await el.play();
      } catch {
        // Browser auto-play policies can block programmatic playback; ignore.
      }
    },
    [defaultFormat, defaultVoice, enabled, stop, tts]
  );

  return {
    speak,
    stop,
    isPending: tts.isPending,
    error: tts.error,
  };
}
