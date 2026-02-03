import { useCallback, useEffect } from "react";
import { Dimensions, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { BiolumOrb } from "@/components/foundation/BiolumOrb";
import { useVoiceSessionNative } from "@/lib/voice/session";
import { trpc } from "@/utils/trpc";

interface FloatingOrbProps {
  onPress: () => void;
  onLongPress: () => void;
}

const { width, height } = Dimensions.get("window");
const ORB_SIZE_DEFAULT = 56;
const ORB_SIZE_LISTENING = 80;
const ORB_SIZE_SPEAKING = 70;
const EDGE_PADDING = 16;

export function FloatingOrb({ onPress, onLongPress }: FloatingOrbProps) {
  const trpcClient = trpc.useContext();
  const voice = useVoiceSessionNative(trpcClient, { surface: "native" });

  const isListening = voice.stream.status === "recording";
  const isSpeaking = voice.stream.status === "playing";

  const getOrbSize = () => {
    if (isListening) {
      return ORB_SIZE_LISTENING;
    }
    if (isSpeaking) {
      return ORB_SIZE_SPEAKING;
    }
    return ORB_SIZE_DEFAULT;
  };
  const orbSize = getOrbSize();

  const translateX = useSharedValue(width - ORB_SIZE_DEFAULT - EDGE_PADDING);
  const translateY = useSharedValue(height - 200);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    translateX.value = withSpring(width - orbSize - EDGE_PADDING, {
      damping: 20,
    });
  }, [orbSize, translateX]);

  const snapToEdge = useCallback(
    (x: number) => {
      "worklet";
      const snapX =
        x > width / 2 ? width - orbSize - EDGE_PADDING : EDGE_PADDING;
      return snapX;
    },
    [orbSize]
  );

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX + translateX.value;
      translateY.value = e.translationY + translateY.value;
    })
    .onEnd((e) => {
      isDragging.value = false;
      const snapX = snapToEdge(e.absoluteX);
      translateX.value = withSpring(snapX, { damping: 20 });
      translateY.value = withSpring(
        Math.max(
          EDGE_PADDING,
          Math.min(height - orbSize - EDGE_PADDING, translateY.value)
        ),
        { damping: 20 }
      );
    });

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(0.9);
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      runOnJS(onPress)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onBegin(() => {
      scale.value = withSpring(1.1);
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      runOnJS(onLongPress)();
    });

  const composedGesture = Gesture.Race(
    panGesture,
    Gesture.Exclusive(longPressGesture, tapGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <BiolumOrb
          size={orbSize}
          pulsing={isListening || isSpeaking}
          active={isListening}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
  },
});
