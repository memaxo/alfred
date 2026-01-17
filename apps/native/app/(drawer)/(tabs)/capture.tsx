/**
 * Capture Screen
 *
 * MVP: text + voice capture into Sense inbox.
 * Derived-only: raw media is not persisted server-side.
 */

import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { ExpoCapture } from "@/lib/voice/capture";
import { trpc } from "@/utils/trpc";

type Mode = "text" | "voice";

function splitTags(input: string): string[] {
  const parts = input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Array.from(new Set(parts)).slice(0, 32);
}

export default function CaptureScreen() {
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
    <Container>
      <Stack.Screen options={{ title: "Capture" }} />

      <View className="flex-1 p-4">
        <View className="mb-4 flex-row gap-2">
          <TouchableOpacity
            className={`flex-1 rounded-lg px-3 py-2 ${
              mode === "text" ? "bg-primary" : "bg-surface"
            }`}
            onPress={() => setMode("text")}
          >
            <Text
              className={`text-center font-semibold ${
                mode === "text" ? "text-primary-foreground" : "text-foreground"
              }`}
            >
              Text
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-lg px-3 py-2 ${
              mode === "voice" ? "bg-primary" : "bg-surface"
            }`}
            onPress={() => setMode("voice")}
          >
            <Text
              className={`text-center font-semibold ${
                mode === "voice" ? "text-primary-foreground" : "text-foreground"
              }`}
            >
              Voice
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mb-3">
          <Text className="mb-2 font-semibold text-foreground">Tags</Text>
          <TextInput
            className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
            onChangeText={setTags}
            placeholder="Optional tags (comma separated)"
            placeholderTextColor="#5A6B7D"
            value={tags}
          />
        </View>

        {mode === "text" ? (
          <>
            <Text className="mb-2 font-semibold text-foreground">Text</Text>
            <TextInput
              className="min-h-[160px] rounded-lg border border-border bg-surface p-3 text-foreground"
              multiline
              onChangeText={setText}
              placeholder="Capture anything..."
              placeholderTextColor="#5A6B7D"
              textAlignVertical="top"
              value={text}
            />

            <TouchableOpacity
              className="mt-4 flex-row items-center justify-center rounded-lg bg-primary px-4 py-3"
              disabled={createMutation.isPending || text.trim().length === 0}
              onPress={sendText}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="font-semibold text-primary-foreground">
                  Send to Inbox
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text className="mb-2 font-semibold text-foreground">Voice</Text>
            <Text className="text-foreground/80 text-sm">
              Tap to start recording, tap again to stop and send. Raw audio is
              not persisted server-side in MVP.
            </Text>

            <TouchableOpacity
              className={`mt-4 flex-row items-center justify-center rounded-lg px-4 py-3 ${
                recording ? "bg-red-500" : "bg-primary"
              }`}
              onPress={() => void toggleVoice()}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="font-semibold text-primary-foreground">
                  {recording ? "Stop + Send" : "Start Recording"}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </Container>
  );
}
