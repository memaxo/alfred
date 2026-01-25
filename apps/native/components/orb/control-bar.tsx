/**
 * ControlBar Component
 *
 * The control bar for the voice call screen.
 * Features mute toggle, end call (long-press), and voice toggle.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { Platform, Pressable, StyleSheet, Vibration, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ALFRED_COLORS } from "./constants";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ControlBarProps {
  /** Whether microphone is muted */
  isMuted: boolean;
  /** Whether the call is active */
  isActive: boolean;
  /** Callback when mute is toggled */
  onMuteToggle: () => void;
  /** Callback when call is ended */
  onEndCall: () => void;
  /** Callback when voice toggle is pressed */
  onToggleVoice: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const END_CALL_LONG_PRESS_DURATION = 800; // ms
const BUTTON_SIZE = 56;
const END_BUTTON_SIZE = 64;

// ─── Component ───────────────────────────────────────────────────────────────

export function ControlBar({
  isMuted,
  isActive,
  onMuteToggle,
  onEndCall,
  onToggleVoice,
}: ControlBarProps) {
  return (
    <View style={styles.container}>
      {/* Left side - Mute button */}
      <MuteButton isMuted={isMuted} onPress={onMuteToggle} />

      {/* Center - End call button (long press) */}
      <EndCallButton onEndCall={onEndCall} />

      {/* Right side - Voice toggle */}
      <VoiceToggleButton isActive={isActive} onPress={onToggleVoice} />
    </View>
  );
}

// ─── Mute Button ─────────────────────────────────────────────────────────────

function MuteButton({
  isMuted,
  onPress,
}: {
  isMuted: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  return (
    <Pressable
      accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"}
      accessibilityRole="button"
      accessibilityState={{ selected: isMuted }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[styles.button, isMuted && styles.buttonMuted, animatedStyle]}
      >
        <Ionicons
          color={isMuted ? ALFRED_COLORS.error : ALFRED_COLORS.text}
          name={isMuted ? "mic-off" : "mic"}
          size={24}
        />
        {isMuted && <View style={styles.muteStrike} />}
      </Animated.View>
    </Pressable>
  );
}

// ─── End Call Button ─────────────────────────────────────────────────────────

function EndCallButton({ onEndCall }: { onEndCall: () => void }) {
  const progress = useSharedValue(0);
  const pressTimeout = useRef<NodeJS.Timeout | null>(null);

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.1 }],
    opacity: 0.3 + progress.value * 0.7,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    borderWidth: 3,
    borderColor: ALFRED_COLORS.error,
    opacity: progress.value,
    transform: [{ scale: 1 + progress.value * 0.2 }],
  }));

  const handlePressIn = () => {
    progress.value = withTiming(1, {
      duration: END_CALL_LONG_PRESS_DURATION,
      easing: Easing.linear,
    });

    pressTimeout.current = setTimeout(() => {
      // Haptic feedback on completion
      if (Platform.OS === "ios") {
        Vibration.vibrate([0, 50]);
      } else {
        Vibration.vibrate(50);
      }
      runOnJS(onEndCall)();
    }, END_CALL_LONG_PRESS_DURATION);
  };

  const handlePressOut = () => {
    progress.value = withTiming(0, { duration: 150 });

    if (pressTimeout.current) {
      clearTimeout(pressTimeout.current);
      pressTimeout.current = null;
    }
  };

  return (
    <Pressable
      accessibilityHint="Press and hold to end the call"
      accessibilityLabel="End call"
      accessibilityRole="button"
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.endButtonContainer}>
        {/* Progress ring */}
        <Animated.View style={[styles.endButtonRing, ringStyle]} />

        {/* Button */}
        <Animated.View style={[styles.endButton, progressStyle]}>
          <Ionicons color={ALFRED_COLORS.text} name="call" size={28} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

// ─── Voice Toggle Button ─────────────────────────────────────────────────────

function VoiceToggleButton({
  isActive,
  onPress,
}: {
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  return (
    <Pressable
      accessibilityLabel={isActive ? "Stop listening" : "Start listening"}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={isActive ? "Stop listening" : "Start listening"}
    >
      <Animated.View style={[styles.button, animatedStyle]}>
        <Ionicons
          color={ALFRED_COLORS.text}
          name={isActive ? "stop" : "mic"}
          size={24}
        />
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: ALFRED_COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ALFRED_COLORS.border,
  },
  buttonMuted: {
    backgroundColor: `${ALFRED_COLORS.error}20`,
    borderColor: ALFRED_COLORS.error,
  },
  muteStrike: {
    position: "absolute",
    width: 28,
    height: 2,
    backgroundColor: ALFRED_COLORS.error,
    transform: [{ rotate: "45deg" }],
  },
  endButtonContainer: {
    width: END_BUTTON_SIZE + 12,
    height: END_BUTTON_SIZE + 12,
    alignItems: "center",
    justifyContent: "center",
  },
  endButtonRing: {
    position: "absolute",
    width: END_BUTTON_SIZE + 12,
    height: END_BUTTON_SIZE + 12,
    borderRadius: (END_BUTTON_SIZE + 12) / 2,
  },
  endButton: {
    width: END_BUTTON_SIZE,
    height: END_BUTTON_SIZE,
    borderRadius: END_BUTTON_SIZE / 2,
    backgroundColor: ALFRED_COLORS.error,
    alignItems: "center",
    justifyContent: "center",
  },
});
