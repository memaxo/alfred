import type { UIMessage } from "@alfred/type/stream";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { setupCarPlay } from "@/lib/carplay";
import { logError } from "@/lib/devlog";
import { useColorScheme } from "@/lib/use-color-scheme";
import { drain, registerQueueDrain, useVoiceSessionNative } from "@/lib/voice";
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
    }),
    [isDarkColorScheme]
  );

  const voice = useVoiceSessionNative(trpcClient);
  const [status, setStatus] = useState<Status>("idle");
  const [reply, setReply] = useState("");

  useEffect(() => {
    if (Platform.OS === "android") {
      ensureForegroundService().catch((error) => {
        logError("voice ForegroundService", error);
      });
    }
  }, []);

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
    [voice]
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

  const handlePressIn = useCallback(async () => {
    setStatus("holding");
    setReply("");
    voice.clear();
    await voice.start();
  }, [voice]);

  const handlePressOut = useCallback(async () => {
    let finalStatus: Status = "idle";
    try {
      setStatus("thinking");
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
  }, [voice]);

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
          {voice.state.transcript || "—"}
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
      {voice.state.error ? (
        <Text className="mt-8 text-center text-rose-500 text-sm">
          {voice.state.error}
        </Text>
      ) : null}
    </View>
  );
}
