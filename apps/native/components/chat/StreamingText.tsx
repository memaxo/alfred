import React, { useEffect, useState } from "react";
import { ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";

interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  characterDelay?: number;
  onComplete?: () => void;
  style?: ViewStyle;
}

export function StreamingText({
  text,
  isStreaming = false,
  characterDelay = 20,
  onComplete,
  style,
}: StreamingTextProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const [displayedText, setDisplayedText] = useState(isStreaming ? "" : text);
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    if (!isStreaming || reduceMotion) {
      setDisplayedText(text);
      onComplete?.();
      return;
    }

    let currentIndex = displayedText.length;
    const targetLength = text.length;

    if (currentIndex >= targetLength) {
      onComplete?.();
      return;
    }

    const interval = setInterval(() => {
      if (currentIndex < targetLength) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, characterDelay);

    return () => clearInterval(interval);
  }, [text, isStreaming, characterDelay, reduceMotion]);

  useEffect(() => {
    if (isStreaming && !reduceMotion) {
      cursorOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 400 }),
          withTiming(1, { duration: 400 })
        ),
        -1,
        false
      );
    } else {
      cursorOpacity.value = 0;
    }
  }, [isStreaming, reduceMotion]);

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <Animated.View style={[{ flexDirection: "row", flexWrap: "wrap" }, style]}>
      <BiolumText variant="body" size="large" color="standard" selectable>
        {displayedText}
      </BiolumText>
      {isStreaming && (
        <Animated.View
          style={[
            {
              width: 2,
              height: 20,
              backgroundColor: theme.colors.biolum.full,
              marginLeft: 2,
            },
            cursorAnimatedStyle,
          ]}
        />
      )}
    </Animated.View>
  );
}

export default StreamingText;
