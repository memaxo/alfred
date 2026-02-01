/**
 * Capture Screen
 *
 * MVP: text + voice capture into Sense inbox.
 * Derived-only: raw media is not persisted server-side.
 */

import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, View, StyleSheet } from "react-native";

import { TextInput as VoidTextInput } from "@/components/form/TextInput";
import {
  BiolumText,
  CaptionText,
  TitleText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { Waveform } from "@/components/voice/Waveform";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { ExpoCapture } from "@/lib/voice/capture";
import { trpc } from "@/utils/trpc";

type Mode = "text" | "voice";

function splitTags(input: string): string[] {
  const parts = input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(parts)].slice(0, 32);
}

export default function CaptureScreen() {
  const theme = useVoidTheme();
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [recording, setRecording] = useState(false);

  const captureRef = useRef<ExpoCapture | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.capture.create.useMutation({
    onSuccess: () => {
      void utils.inbox.list.invalidate();
      setText("");
      setTags("");
      setRecording(false);
    },
  });

  const evidence = useMemo(() => {
    const device = `${Platform.OS}`;
    return {
      capturedAt: new Date().toISOString(),
      tags: splitTags(tags),
      device,
      surface: "native" as const,
    };
  }, [tags]);

  const sendText = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    createMutation.mutate({
      payload: { kind: "text", text: trimmed },
      evidence,
    });
  }, [text, createMutation, evidence]);

  const toggleVoice = useCallback(async () => {
    if (createMutation.isPending) {
      return;
    }

    if (!captureRef.current) {
      captureRef.current = new ExpoCapture();
    }

    if (!recording) {
      setRecording(true);
      await captureRef.current.start();
      return;
    }

    try {
      const clip = await captureRef.current.stop();
      setRecording(false);
      if (!clip?.audioBase64) {
        return;
      }
      createMutation.mutate({
        payload: {
          kind: "voice",
          audioBase64: clip.audioBase64,
          mimeType: clip.mimeType,
        },
        evidence,
      });
    } catch {
      setRecording(false);
    }
  }, [recording, createMutation, evidence]);

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      <Stack.Screen
        options={{
          title: "Capture",
          headerStyle: { backgroundColor: theme.colors.void.deep },
          headerTintColor: theme.colors.biolum.full,
        }}
      />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TitleText size="large" color="full">
            Capture
          </TitleText>
          <CaptionText size="medium" color="dim">
            Capture text or voice to your inbox
          </CaptionText>
        </View>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <FluidButton
            label="Text"
            variant={mode === "text" ? "primary" : "ghost"}
            size="medium"
            onPress={() => setMode("text")}
            style={styles.modeButton}
          />
          <FluidButton
            label="Voice"
            variant={mode === "voice" ? "primary" : "ghost"}
            size="medium"
            onPress={() => setMode("voice")}
            style={styles.modeButton}
          />
        </View>

        {/* Tags Input */}
        <HUDSurface elevation={1} style={styles.card}>
          <VoidTextInput
            label="Tags (optional)"
            value={tags}
            onChangeText={setTags}
            placeholder="Comma separated tags..."
          />
        </HUDSurface>

        {mode === "text" ? (
          <>
            {/* Text Input */}
            <HUDSurface elevation={1} style={styles.card}>
              <VoidTextInput
                label="Text"
                value={text}
                onChangeText={setText}
                placeholder="Capture anything..."
                multiline
                numberOfLines={6}
                style={styles.textArea}
              />
            </HUDSurface>

            {/* Send Button */}
            <FluidButton
              label={createMutation.isPending ? "Sending..." : "Send to Inbox"}
              variant="primary"
              size="large"
              onPress={sendText}
              disabled={createMutation.isPending || text.trim().length === 0}
              style={styles.sendButton}
            />
          </>
        ) : (
          <>
            {/* Voice Section */}
            <HUDSurface elevation={1} style={styles.card}>
              <CaptionText size="small" color="faint" style={styles.label}>
                Voice
              </CaptionText>
              <BiolumText
                variant="body"
                size="small"
                color="dim"
                style={styles.voiceHint}
              >
                Tap to start recording, tap again to stop and send.
              </BiolumText>

              {recording && (
                <View style={styles.waveformContainer}>
                  <Waveform
                    audioLevel={0.5}
                    active={true}
                    barCount={24}
                    height={48}
                  />
                </View>
              )}
            </HUDSurface>

            {/* Record Button */}
            <FluidButton
              label={
                createMutation.isPending
                  ? "Processing..."
                  : (recording
                    ? "Stop + Send"
                    : "Start Recording")
              }
              variant={recording ? "secondary" : "primary"}
              size="large"
              onPress={() => void toggleVoice()}
              disabled={createMutation.isPending}
              style={styles.sendButton}
            />
          </>
        )}
      </View>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  modeSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  label: {
    marginBottom: 8,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  voiceHint: {
    marginBottom: 16,
  },
  waveformContainer: {
    marginTop: 16,
  },
  sendButton: {
    marginTop: 8,
  },
});
