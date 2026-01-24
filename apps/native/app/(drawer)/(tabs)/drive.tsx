import type { UIMessage } from "@alfred/type/stream";
import type { TRPCClient } from "@trpc/client";

import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Platform, Pressable, View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { PendingItem } from "@/lib/voice/queue";
import type { TRPCAppRouter } from "@/utils/trpc";

import {
  BiolumText,
  CaptionText,
  TitleText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { VADIndicator } from "@/components/voice/VADIndicator";
import { Waveform } from "@/components/voice/Waveform";
import { useVoidTheme, useReducedMotion } from "@/hooks/use-void-theme";
import { useServerUrl, useTrpcClient } from "@/lib/api";
import { useAuthClient } from "@/lib/auth-client";
import { setupCarPlay } from "@/lib/carplay";
import { logError } from "@/lib/devlog";
import {
  drain,
  playBase64,
  registerQueueDrain,
  useVoiceSessionNative,
} from "@/lib/voice";
import { getCookieFromAuthClient } from "@/lib/voice/cookie";
import { ensureForegroundService } from "@/lib/voice/foreground";
import { trpc } from "@/utils/trpc";

const THREAD_ID = "drive-mode";

type Status = "idle" | "holding" | "thinking" | "responding" | "error";

type VoiceSession = ReturnType<typeof useVoiceSessionNative>;

async function processQueueItem(
  item: PendingItem,
  voice: VoiceSession,
  trpcClient: TRPCClient<TRPCAppRouter>
): Promise<unknown> {
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
}

export default function DriveScreen() {
  const router = useRouter();
  const trpcClient = useTrpcClient<TRPCAppRouter>();
  const authClient = useAuthClient();
  const { serverUrl } = useServerUrl();
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();

  const { data: prefs } = trpc.preference.list.useQuery({
    limit: 100,
    offset: 0,
  });
  const sttChunkSize =
    (prefs?.find(
      (p: { key: string; value?: unknown }) => p.key === "voice.stt.chunk_size"
    )?.value as "fast" | "low" | "medium" | "accurate" | undefined) ??
    undefined;

  const voice = useVoiceSessionNative(trpcClient, {
    surface: "drive",
    getCookie: () => getCookieFromAuthClient(authClient),
    baseUrl: serverUrl,
    sttChunkSize,
  });
  const useStreaming = voice.stream?.supported ?? false;
  const [status, setStatus] = useState<Status>("idle");
  const [reply, setReply] = useState("");
  const workflowRunId = voice.stream?.workflow?.runId ?? null;

  // Orb animation values
  const orbScale = useSharedValue(1);
  const orbGlow = useSharedValue(0.3);

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
    async (item: PendingItem): Promise<void> => {
      try {
        await processQueueItem(item, voice, trpcClient);
      } catch (error) {
        logError("voice QueueDrain process", error);
        throw error;
      }
    },
    [trpcClient, voice]
  );

  useEffect(() => {
    registerQueueDrain(async () => {
      await drain(processPendingItem);
    });
  }, [processPendingItem]);

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
    try {
      setupCarPlay(voice, (text) => {
        setStatus("thinking");
        setReply(text);
      });
    } catch (error) {
      logError("CarPlay setup", error);
    }
  }, [voice]);

  useEffect(() => {
    if (!voice.stream?.supported) return;
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
    }
  }, [
    voice.stream?.assistantText,
    voice.stream?.status,
    voice.stream?.supported,
  ]);

  // Orb animation effect
  useEffect(() => {
    if (reduceMotion) return;

    if (status === "holding") {
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      orbGlow.value = withTiming(0.8, { duration: 300 });
    } else if (status === "thinking") {
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 300 }),
          withTiming(0.98, { duration: 300 })
        ),
        -1,
        true
      );
      orbGlow.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 300 }),
          withTiming(0.4, { duration: 300 })
        ),
        -1,
        true
      );
    } else if (status === "responding") {
      orbScale.value = withTiming(1.08, { duration: 200 });
      orbGlow.value = withTiming(1, { duration: 200 });
    } else {
      orbScale.value = withSpring(1);
      orbGlow.value = withTiming(0.3, { duration: 500 });
    }
  }, [status, reduceMotion]);

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
  }, [voice, trpcClient]);

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

  const transcriptText =
    useStreaming && voice.stream
      ? voice.stream.transcript || voice.state.transcript
      : voice.state.transcript;

  const vadLevel =
    voice.stream && typeof voice.stream.vadConfidence === "number"
      ? Math.min(1, Math.max(0, voice.stream.vadConfidence ?? 0))
      : 0;

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
        return 'Tap mic or say "Hey Alfred" to start';
    }
  }, [voice.stream?.error, voice.stream?.status, voice.stream?.supported]);

  const orbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    shadowOpacity: orbGlow.value,
  }));

  const getOrbColor = () => {
    switch (status) {
      case "error":
        return theme.colors.semantic.error;
      case "holding":
        return theme.colors.semantic.success;
      case "thinking":
        return theme.colors.biolum.bright;
      case "responding":
        return theme.colors.biolum.full;
      default:
        return theme.colors.biolum.standard;
    }
  };

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TitleText size="medium" color="full">
          Drive Mode
        </TitleText>
        <CaptionText size="medium" color="dim">
          {handsFreeLabel}
        </CaptionText>
      </View>

      {/* Main Orb */}
      <View style={styles.orbContainer}>
        <Animated.View
          style={[
            styles.orb,
            {
              backgroundColor: getOrbColor(),
              shadowColor: getOrbColor(),
            },
            orbAnimatedStyle,
          ]}
        >
          <Pressable
            accessibilityHint="Press and hold to talk with Alfred. Release to send."
            accessibilityRole="button"
            style={styles.orbPressable}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <BiolumText variant="body" size="large" color="full">
              {label}
            </BiolumText>
          </Pressable>
        </Animated.View>

        {/* VAD Ring */}
        {voice.stream?.supported && status === "holding" && (
          <VADIndicator
            active={true}
            intensity={vadLevel}
            size={220}
            style={styles.vadRing}
          />
        )}
      </View>

      {/* Waveform */}
      {status === "holding" && (
        <View style={styles.waveformContainer}>
          <Waveform
            audioLevel={vadLevel}
            active={true}
            barCount={32}
            height={60}
          />
        </View>
      )}

      {/* Transcript Section */}
      <HUDSurface elevation={1} style={styles.card}>
        <CaptionText size="small" color="faint" style={styles.cardLabel}>
          Transcript
        </CaptionText>
        <BiolumText
          variant="body"
          size="medium"
          color="standard"
          numberOfLines={3}
        >
          {transcriptText || "—"}
        </BiolumText>
      </HUDSurface>

      {/* Response Section */}
      <HUDSurface elevation={1} style={styles.card}>
        <CaptionText size="small" color="faint" style={styles.cardLabel}>
          Response
        </CaptionText>
        <BiolumText
          variant="body"
          size="medium"
          color="bright"
          numberOfLines={3}
        >
          {reply || "Awaiting reply"}
        </BiolumText>
      </HUDSurface>

      {/* Workflow Card */}
      {workflowRunId && (
        <HUDSurface elevation={2} style={styles.card}>
          <View style={styles.workflowHeader}>
            <BiolumText variant="body" size="medium" color="full">
              Workflow ready
            </BiolumText>
            <CaptionText size="small" color="dim">
              Run ID: {workflowRunId.slice(-8)}
            </CaptionText>
          </View>
          <FluidButton
            label="Open workflow details"
            variant="primary"
            size="medium"
            onPress={() => router.push(`/workflows/${workflowRunId}`)}
            style={styles.workflowButton}
          />
        </HUDSurface>
      )}

      {/* Streaming Status Card */}
      {voice.stream?.supported && (
        <HUDSurface elevation={1} style={styles.card}>
          <View style={styles.streamingHeader}>
            <BiolumText variant="body" size="small" color="standard">
              Hands-free streaming
            </BiolumText>
            <CaptionText
              size="small"
              color={voice.stream.status === "recording" ? "bright" : "dim"}
            >
              {voice.stream.status.toUpperCase()}
            </CaptionText>
          </View>

          {/* VAD Progress Bar */}
          <View
            style={[
              styles.vadTrack,
              { backgroundColor: theme.colors.glass.surface },
            ]}
          >
            <View
              style={[
                styles.vadFill,
                {
                  backgroundColor: theme.colors.semantic.success,
                  width: `${Math.round(vadLevel * 100)}%`,
                },
              ]}
            />
          </View>

          <View style={styles.vadLabels}>
            <CaptionText size="small" color="faint">
              VAD: {Math.round(vadLevel * 100)}%
            </CaptionText>
            <CaptionText size="small" color="faint">
              {voice.stream.autoStopReason
                ? `Auto-stop: ${voice.stream.autoStopReason}`
                : "Auto-stop arms on silence"}
            </CaptionText>
          </View>

          {voice.session && (
            <CaptionText size="small" color="faint" style={styles.sessionInfo}>
              Session: {voice.session.id.slice(-8)} · Updated{" "}
              {new Date(voice.session.updatedAt).toLocaleTimeString()}
            </CaptionText>
          )}
        </HUDSurface>
      )}

      {/* Error Messages */}
      {(voice.state.error || voice.stream?.error) && (
        <HUDSurface elevation={1} style={[styles.card, styles.errorCard]}>
          <BiolumText
            variant="body"
            size="small"
            style={{ color: theme.colors.semantic.error }}
          >
            {voice.state.error || voice.stream?.error}
          </BiolumText>
        </HUDSurface>
      )}
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 16,
  },
  orbContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 240,
    marginVertical: 24,
  },
  orb: {
    width: 192,
    height: 192,
    borderRadius: 96,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 40,
    elevation: 8,
  },
  orbPressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 96,
  },
  vadRing: {
    position: "absolute",
  },
  waveformContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  cardLabel: {
    marginBottom: 8,
  },
  workflowHeader: {
    marginBottom: 12,
  },
  workflowButton: {
    marginTop: 8,
  },
  streamingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  vadTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  vadFill: {
    height: "100%",
    borderRadius: 4,
  },
  vadLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sessionInfo: {
    marginTop: 8,
  },
  errorCard: {
    borderColor: "rgba(200, 145, 145, 0.3)",
  },
});
