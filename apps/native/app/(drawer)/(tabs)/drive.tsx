import type { UIMessage } from "@alfred/type/stream";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { setupCarPlay } from "@/lib/carplay";
import { logError } from "@/lib/devlog";
import { useColorScheme } from "@/lib/use-color-scheme";
import {
  drain,
  playBase64,
  registerQueueDrain,
  useVoiceSessionNative,
} from "@/lib/voice";
import type { PendingItem } from "@/lib/voice/queue";
import { ensureForegroundService } from "@/lib/voice/service";
import { trpcClient } from "@/utils/trpc";

const THREAD_ID = "drive-mode";

type Status = "idle" | "holding" | "thinking" | "responding" | "error";

export default function DriveScreen() {
  const { isDarkColorScheme } = useColorScheme();
  const palette = useMemo(
    () => ({
      background: isDarkColorScheme ? "bg-black" : "bg-white",
      text: isDarkColorScheme ? "text-white" : "text-black",
      subtle: isDarkColorScheme ? "text-gray-400" : "text-gray-500",
      buttonIdle: isDarkColorScheme ? "bg-sky-500" : "bg-blue-500",
      buttonActive: "bg-emerald-500",
      buttonError: "bg-rose-500",
      cardBg: isDarkColorScheme ? "bg-white/5" : "bg-black/5",
      cardBorder: isDarkColorScheme ? "border-white/10" : "border-black/10",
      meterTrack: isDarkColorScheme ? "bg-white/20" : "bg-black/10",
      meterFill: isDarkColorScheme ? "bg-emerald-400" : "bg-emerald-500",
      streamAccent: isDarkColorScheme ? "text-emerald-300" : "text-emerald-600",
    }),
    [isDarkColorScheme]
  );

  const voice = useVoiceSessionNative(trpcClient, { surface: "drive" });
  const useStreaming = voice.stream?.supported ?? false;
  const [status, setStatus] = useState<Status>("idle");
  const [reply, setReply] = useState("");

  useEffect(() => {
    if (Platform.OS === "android") {
      ensureForegroundService().catch((error) => {
        logError("voice ForegroundService", error);
      });
    }
  }, []);

  useEffect(() => {
    voice.refreshSession?.().catch((error) => {
      logError("voice refresh-session", error);
    });
  }, [voice]);

  const processPendingItem = useCallback(
    async (item: PendingItem) => {
      try {
        if (item.kind === "stt") {
          const result = await trpcClient.voice.sttTranscribe.mutate({
            audioBase64: item.payload.audioBase64,
            mimeType: item.payload.mimeType,
            language: item.payload.language,
            prompt: item.payload.prompt,
          });
          return result;
        }
        if (item.kind === "s2s") {
          const response = await trpcClient.voice.speechToSpeech.mutate({
            audioBase64: item.payload.audioBase64,
            mimeType: item.payload.mimeType,
            language: item.payload.language,
            prompt: item.payload.prompt,
            thread: item.payload.thread,
            resource: item.payload.resource,
            ttsVoice: item.payload.ttsVoice,
            ttsFormat: item.payload.ttsFormat,
            sessionId: item.payload.sessionId,
            surface: item.payload.surface ?? "drive",
          });
          const audio = response?.audio;
          if (audio?.audioBase64) {
            await playBase64(audio.audioBase64, audio.mimeType);
          } else if (response?.assistant?.text) {
            await voice.speak({
              text: response.assistant.text,
              voice: item.payload.ttsVoice ?? "alloy",
              format: item.payload.ttsFormat ?? "mp3",
            });
          }
          voice.syncSession?.(response?.session ?? null);
          await voice.refreshSession?.();
          return response;
        }

        const result = await trpcClient.voice.ttsSynthesize.mutate({
          text: item.payload.text,
          voice: item.payload.voice,
        });

        if (result?.audioBase64) {
          await voice.speak({
            text: item.payload.text,
            format: "mp3",
            voice: item.payload.voice ?? "alloy",
          });
        }
        return result;
      } catch (error) {
        logError("voice QueueDrain process", error);
        throw error;
      }
    },
    [trpcClient, voice]
  );

  useEffect(() => {
    // Register background task to drain queue
    registerQueueDrain(async () => {
      await drain(processPendingItem);
    });
  }, [processPendingItem]);

  // Drain queue on app resume
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        drain(processPendingItem).catch((error) => {
          logError("voice QueueDrain resume", error);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [processPendingItem]);

  useEffect(() => {
    setupCarPlay(voice, (text) => {
      setStatus("thinking");
      setReply(text);
    });
  }, [voice]);

  useEffect(() => {
    if (!voice.stream?.supported) {
      return;
    }
    switch (voice.stream.status) {
      case "recording":
        setStatus("holding");
        break;
      case "processing":
        setStatus("thinking");
        break;
      case "playing":
        setStatus("responding");
        break;
      case "idle":
        if (voice.stream.assistantText) {
          setReply(voice.stream.assistantText);
          setStatus("idle");
        }
        break;
      case "error":
        setStatus("error");
        break;
      default:
        break;
    }
  }, [
    voice.stream?.assistantText,
    voice.stream?.status,
    voice.stream?.supported,
  ]);

  const handlePressIn = useCallback(async () => {
    setReply("");
    voice.clear();
    try {
      setStatus("holding");
      if (voice.stream?.supported) {
        await voice.stream.start();
      } else {
        await voice.start();
      }
    } catch (error) {
      logError("voice DrivePressIn", error);
      setStatus("error");
    }
  }, [voice]);

  const handlePressOut = useCallback(async () => {
    let finalStatus: Status = "idle";
    try {
      if (voice.stream?.supported) {
        setStatus("thinking");
        await voice.stream.stop();
        return;
      }
      setStatus("thinking");
      if (voice.speechToSpeech) {
        const result = await voice.speechToSpeech({
          thread: THREAD_ID,
          resource: THREAD_ID,
          ttsVoice: "alloy",
          ttsFormat: "mp3",
        });
        const answer = result?.assistant?.text ?? "";
        setReply(answer || "I heard you.");
        setStatus("responding");
        finalStatus = "idle";
        return;
      }
      const result = await voice.stopAndTranscribe();
      if (!result?.text) {
        setStatus("idle");
        return;
      }
      const messages: UIMessage[] = [
        {
          id: `user-${Date.now()}`,
          role: "user",
          parts: [{ type: "text", text: result.text }],
        },
      ];
      const response = await trpcClient.assistant.generate.mutate({
        thread: THREAD_ID,
        resource: THREAD_ID,
        messages,
      });
      const answer = response?.text ?? "";
      setReply(answer);
      setStatus("responding");
      await voice.speak({
        text: answer || "I heard you.",
        format: "mp3",
        voice: "alloy",
      });
      finalStatus = "idle";
    } catch (error) {
      logError("voice DriveInteraction", error);
      setStatus("error");
      finalStatus = "error";
    } finally {
      setStatus(finalStatus);
    }
  }, [trpcClient, voice]);

  const label = useMemo(() => {
    switch (status) {
      case "holding":
        return "Listening…";
      case "thinking":
        return "Thinking…";
      case "responding":
        return "Speaking…";
      case "error":
        return "Check connection";
      default:
        return "Hold to talk";
    }
  }, [status]);

  const buttonStyle = (() => {
    if (status === "error") {
      return palette.buttonError;
    }
    if (status === "holding") {
      return palette.buttonActive;
    }
    return palette.buttonIdle;
  })();

  const transcriptText =
    useStreaming && voice.stream
      ? voice.stream.transcript || voice.state.transcript
      : voice.state.transcript;

  const vadPercent =
    voice.stream && typeof voice.stream.vadConfidence === "number"
      ? Math.round(
          Math.min(1, Math.max(0, voice.stream.vadConfidence ?? 0)) * 100
        )
      : null;

  const handsFreeLabel = useMemo(() => {
    if (!voice.stream?.supported) {
      return "Hands-free unavailable";
    }
    switch (voice.stream.status) {
      case "recording":
        return "Listening (auto-stop armed)";
      case "processing":
        return "Processing reply…";
      case "playing":
        return "Speaking…";
      case "error":
        return voice.stream.error ?? "Streaming error";
      default:
        return "Tap mic or say “Hey Alfred” to start";
    }
  }, [voice.stream?.error, voice.stream?.status, voice.stream?.supported]);

  return (
    <View
      className={`flex-1 ${palette.background} items-center justify-center px-6`}
    >
      <Text
        accessibilityRole="header"
        className={`font-semibold text-2xl ${palette.text} mb-8`}
      >
        Drive Mode
      </Text>
      <Pressable
        accessibilityHint="Press and hold to talk with Alfred. Release to send."
        accessibilityRole="button"
        className={`h-48 w-48 items-center justify-center rounded-full ${buttonStyle} shadow-lg`}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text className="font-semibold text-white text-xl">{label}</Text>
      </Pressable>
      <View className="mt-10 w-full items-center">
        <Text className={`text-base ${palette.subtle}`}>Transcript</Text>
        <Text
          className={`mt-2 text-lg ${palette.text} text-center`}
          numberOfLines={3}
        >
          {transcriptText || "—"}
        </Text>
      </View>
      <View className="mt-8 w-full items-center">
        <Text className={`text-base ${palette.subtle}`}>Response</Text>
        <Text
          className={`mt-2 text-lg ${palette.text} text-center`}
          numberOfLines={3}
        >
          {reply || "Awaiting reply"}
        </Text>
      </View>
      {voice.stream?.supported ? (
        <View
          className={`mt-8 w-full rounded-2xl border ${palette.cardBorder} ${palette.cardBg} p-4`}
        >
          <View className="flex-row items-center justify-between">
            <Text className={`text-sm font-semibold ${palette.text}`}>
              Hands-free streaming
            </Text>
            <Text
              className={`text-xs ${
                voice.stream.status === "recording"
                  ? palette.streamAccent
                  : palette.subtle
              }`}
            >
              {voice.stream.status.toUpperCase()}
            </Text>
          </View>
          <Text className={`mt-2 text-base ${palette.text}`}>
            {handsFreeLabel}
          </Text>
          <View
            className={`mt-4 h-2 w-full overflow-hidden rounded-full ${palette.meterTrack}`}
          >
            <View
              className={`h-full rounded-full ${palette.meterFill}`}
              style={{ width: `${vadPercent ?? 0}%` }}
            />
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className={`text-xs ${palette.subtle}`}>
              VAD: {vadPercent === null ? "—" : `${vadPercent}%`}
            </Text>
            <Text className={`text-xs ${palette.subtle}`}>
              {voice.stream.autoStopReason
                ? `Auto-stop: ${voice.stream.autoStopReason}`
                : "Auto-stop arms on silence"}
            </Text>
          </View>
          {voice.session ? (
            <Text className={`mt-2 text-xs ${palette.subtle}`}>
              Session: {voice.session.id.slice(-8)} · Updated{" "}
              {new Date(voice.session.updatedAt).toLocaleTimeString()}
            </Text>
          ) : null}
        </View>
      ) : null}
      {voice.state.error ? (
        <Text className="mt-8 text-center text-rose-500 text-sm">
          {voice.state.error}
        </Text>
      ) : null}
      {voice.stream?.error ? (
        <Text className="mt-2 text-center text-rose-500 text-sm">
          {voice.stream.error}
        </Text>
      ) : null}
    </View>
  );
}
