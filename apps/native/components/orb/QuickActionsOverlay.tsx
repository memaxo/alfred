import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { BiolumOrb } from "@/components/foundation/BiolumOrb";
import { useColorScheme } from "@/lib/use-color-scheme";

interface QuickActionsOverlayProps {
  visible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get("window");

interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  angle: number;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "voice",
    label: "Voice",
    icon: "mic",
    route: "/(drawer)/call",
    angle: -90,
  },
  {
    id: "capture",
    label: "Capture",
    icon: "add-circle",
    route: "/(drawer)/capture",
    angle: -30,
  },
  {
    id: "focus",
    label: "Focus",
    icon: "locate",
    route: "/(drawer)/focus",
    angle: 30,
  },
  {
    id: "workflows",
    label: "Flows",
    icon: "git-branch",
    route: "/(drawer)/(tabs)/workflows",
    angle: 90,
  },
];

const ORB_SIZE = 100;
const ACTION_RADIUS = 140;
const ACTION_SIZE = 64;

export function QuickActionsOverlay({
  visible,
  onClose,
}: QuickActionsOverlayProps) {
  const router = useRouter();
  const { isDarkColorScheme } = useColorScheme();

  const backdropOpacity = useSharedValue(0);
  const orbScale = useSharedValue(0);

  if (visible) {
    backdropOpacity.value = withSpring(1);
    orbScale.value = withSpring(1);
  } else {
    backdropOpacity.value = withSpring(0);
    orbScale.value = withSpring(0);
  }

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const handleActionPress = useCallback(
    (route: string) => {
      onClose();
      router.push(route as never);
    },
    [onClose, router]
  );

  const tapGesture = Gesture.Tap().onEnd(() => {
    onClose();
  });

  if (!visible) return null;

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[styles.container, backdropStyle]}
      >
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose}>
          <View />
        </Pressable>

        {/* Centered Orb */}
        <Animated.View style={[styles.orbContainer, orbStyle]}>
          <BiolumOrb size={ORB_SIZE} pulsing={true} active={true} />
        </Animated.View>

        {/* Radial Actions */}
        {QUICK_ACTIONS.map((action, index) => {
          const angleRad = (action.angle * Math.PI) / 180;
          const x = Math.cos(angleRad) * ACTION_RADIUS;
          const y = Math.sin(angleRad) * ACTION_RADIUS;

          return (
            <Animated.View
              key={action.id}
              entering={FadeIn.delay(index * 50).duration(300)}
              exiting={FadeOut.duration(200)}
              style={[
                styles.actionContainer,
                {
                  transform: [{ translateX: x }, { translateY: y }],
                },
              ]}
            >
              <Pressable
                onPress={() => handleActionPress(action.route)}
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: isDarkColorScheme
                      ? "rgba(30, 30, 30, 0.95)"
                      : "rgba(255, 255, 255, 0.95)",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name={action.icon} size={28} color="#00D9FF" />
              </Pressable>
              <Text
                style={[
                  styles.actionLabel,
                  { color: isDarkColorScheme ? "#fff" : "#000" },
                ]}
              >
                {action.label}
              </Text>
            </Animated.View>
          );
        })}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  orbContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  actionContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  actionLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
  },
});
