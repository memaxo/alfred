import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
}

export interface ChoiceProps {
  options: ChoiceOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  label?: string;
  disabled?: boolean;
}

export function Choice({
  options,
  value,
  onChange,
  multiple = false,
  label,
  disabled = false,
}: ChoiceProps) {
  const theme = useVoidTheme();

  const handleSelect = (optionValue: string) => {
    if (disabled) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
    }
  };

  const isSelected = (optionValue: string) => {
    if (multiple) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  };

  return (
    <View style={styles.container}>
      {label && (
        <BiolumText
          variant="body"
          size="small"
          color="dim"
          style={styles.label}
        >
          {label}
        </BiolumText>
      )}
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <ChoiceItem
            key={option.value}
            option={option}
            selected={isSelected(option.value)}
            onSelect={() => handleSelect(option.value)}
            multiple={multiple}
            disabled={disabled}
            theme={theme}
          />
        ))}
      </View>
    </View>
  );
}

interface ChoiceItemProps {
  option: ChoiceOption;
  selected: boolean;
  onSelect: () => void;
  multiple: boolean;
  disabled: boolean;
  theme: ReturnType<typeof useVoidTheme>;
}

function ChoiceItem({
  option,
  selected,
  onSelect,
  multiple,
  disabled,
  theme,
}: ChoiceItemProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(selected ? 0.1 : 0);

  const handlePress = () => {
    onSelect();
    if (!reduceMotion) {
      scale.value = withSpring(0.98, { damping: 15 });
      scale.value = withSpring(1, { damping: 15 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  const IconComponent = multiple
    ? selected
      ? "checkbox"
      : "square-outline"
    : selected
      ? "radio-button-on"
      : "radio-button-off";

  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <Animated.View
        style={[
          styles.optionItem,
          {
            backgroundColor: selected
              ? theme.colors.glass.hover
              : theme.colors.glass.surface,
            borderColor: selected
              ? theme.colors.biolum.dim
              : theme.colors.glass.border,
            shadowColor: theme.colors.biolum.full,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 10,
            elevation: 1,
          },
          animatedStyle,
          glowStyle,
        ]}
      >
        <Ionicons
          name={IconComponent}
          size={20}
          color={
            selected ? theme.colors.biolum.full : theme.colors.biolum.faint
          }
        />
        <View style={styles.optionContent}>
          <BiolumText
            variant="body"
            size="medium"
            color={disabled ? "faint" : selected ? "full" : "standard"}
          >
            {option.label}
          </BiolumText>
          {option.description && (
            <CaptionText size="small" color="dim">
              {option.description}
            </CaptionText>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    marginBottom: 8,
  },
  optionsContainer: {
    gap: 8,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  optionContent: {
    flex: 1,
    gap: 2,
  },
});

export default Choice;
