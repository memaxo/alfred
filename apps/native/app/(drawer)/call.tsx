/**
 * Voice Call Screen
 *
 * Full-screen voice interaction with Alfred.
 * Features the neural orb visualization that responds to voice states.
 */

import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ALFRED_COLORS, ORB_SIZES, Orb, useOrbState } from "@/components/orb";
import { ControlBar } from "@/components/orb/control-bar";
import { useVoiceSessionNative } from "@/lib/voice/session";
import { trpcClient } from "@/utils/trpc";

// ─── Component ───────────────────────────────────────────────────────────────

export default function VoiceCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const orbSize = Math.min(width * 0.85, ORB_SIZES.full);
  const startedAtRef = useRef<number>(Date.now());
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Voice session
  const { stream } = useVoiceSessionNative(trpcClient, { surface: "native" });

  // Map voice state to orb props
  const orbProps = useOrbState({
    status: stream.status as
      | "idle"
      | "connecting"
      | "recording"
      | "processing"
      | "playing"
      | "error",
    vadConfidence: stream.vadConfidence,
    isActive: stream.isActive,
    error: stream.error,
  });

  // Handlers
  const handleEndCall = useCallback(() => {
    void stream
      .stop()
      .catch(() => {
        // ignore
      })
      .finally(() => {
        router.back();
      });
  }, [stream, router]);

  const handleToggleVoice = useCallback(async () => {
    if (stream.isActive) {
      await stream.stop();
    } else {
      await stream.start();
    }
  }, [stream]);

  const handleMuteToggle = useCallback(() => {
    const next = stream.toggleMute();
    setIsMuted(next);
  }, [stream]);

  const handleKeyboardToggle = useCallback(() => {
    // Navigate to text chat or show keyboard input
    router.back();
  }, [router]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const callDuration = useMemo(() => {
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }, [elapsedSec]);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor={ALFRED_COLORS.background}
        barStyle="light-content"
      />

      <Stack.Screen
        options={{
          headerShown: false,
          animation: "fade",
          presentation: "fullScreenModal",
        }}
      />

      {/* Background */}
      <View style={styles.background} />

      {/* Header */}
      <Animated.View
        entering={FadeIn.delay(200)}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity
          accessibilityHint="Ends the call"
          accessibilityLabel="End call"
          accessibilityRole="button"
          onPress={handleEndCall}
          style={styles.backButton}
        >
          <Ionicons
            color={ALFRED_COLORS.textMuted}
            name="chevron-down"
            size={28}
          />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.callDuration}>{callDuration}</Text>
        </View>

        <TouchableOpacity
          accessibilityLabel="Call options"
          accessibilityRole="button"
          onPress={handleKeyboardToggle}
          style={styles.menuButton}
        >
          <Ionicons
            color={ALFRED_COLORS.textMuted}
            name="ellipsis-vertical"
            size={20}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Main content - Orb */}
      <View style={styles.orbContainer}>
        <Orb
          inputVolume={orbProps.inputVolume}
          outputVolume={orbProps.outputVolume}
          showParticles={true}
          size={orbSize}
          state={orbProps.state}
        />

        {/* Status label */}
        {orbProps.statusLabel ? (
          <Animated.Text
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.statusLabel}
          >
            {orbProps.statusLabel}
          </Animated.Text>
        ) : null}
      </View>

      {/* Transcript preview (when available) */}
      {stream.transcript ? (
        <Animated.View
          entering={SlideInDown}
          style={styles.transcriptContainer}
        >
          <Text numberOfLines={2} style={styles.transcriptText}>
            {stream.transcript}
          </Text>
        </Animated.View>
      ) : null}

      {/* Control bar */}
      <Animated.View
        entering={SlideInDown.delay(100)}
        style={[
          styles.controlBarContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        <ControlBar
          isActive={orbProps.isActive}
          isMuted={isMuted}
          onEndCall={handleEndCall}
          onMuteToggle={handleMuteToggle}
          onToggleVoice={handleToggleVoice}
        />
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ALFRED_COLORS.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ALFRED_COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  callDuration: {
    fontSize: 17,
    fontWeight: "500",
    color: ALFRED_COLORS.textMuted,
    fontVariant: ["tabular-nums"],
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  orbContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    marginTop: 24,
    fontSize: 17,
    color: ALFRED_COLORS.primary,
    fontWeight: "400",
  },
  transcriptContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  transcriptText: {
    fontSize: 16,
    color: ALFRED_COLORS.textMuted,
    textAlign: "center",
    lineHeight: 24,
  },
  controlBarContainer: {
    paddingHorizontal: 24,
  },
});
