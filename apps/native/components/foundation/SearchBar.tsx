import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo } from "react";
import {
  type ViewStyle,
  type PressableStateCallbackType,
  View,
  TextInput,
  StyleSheet,
  Pressable,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "@/hooks/use-void-theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
  style?: ViewStyle;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  onFocus,
  onBlur,
  onClear,
  autoFocus = false,
  style,
}: SearchBarProps) {
  const reduceMotion = useReducedMotion();
  const borderOpacity = useSharedValue(0.1);

  const handleFocus = useCallback(() => {
    borderOpacity.value = reduceMotion
      ? 0.3
      : withTiming(0.3, { duration: 200 });
    onFocus?.();
  }, [onFocus, borderOpacity, reduceMotion]);

  const handleBlur = useCallback(() => {
    borderOpacity.value = reduceMotion
      ? 0.1
      : withTiming(0.1, { duration: 200 });
    onBlur?.();
  }, [onBlur, borderOpacity, reduceMotion]);

  const handleClear = useCallback(() => {
    onChangeText("");
    onClear?.();
  }, [onChangeText, onClear]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(0, 217, 255, ${borderOpacity.value})`,
  }));

  const clearButtonStyle = useMemo(
    () =>
      ({ pressed }: PressableStateCallbackType) => [
        styles.clearButton,
        pressed && styles.clearButtonPressed,
      ],
    []
  );

  return (
    <AnimatedView style={[styles.container, animatedStyle, style]}>
      <Ionicons
        name="search"
        size={18}
        color="rgba(255,255,255,0.4)"
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable
          onPress={handleClear}
          style={clearButtonStyle}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons
            name="close-circle"
            size={18}
            color="rgba(255,255,255,0.4)"
          />
        </Pressable>
      )}
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearButtonPressed: {
    opacity: 0.7,
  },
});

export default SearchBar;
