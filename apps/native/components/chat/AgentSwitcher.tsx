import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";

type AgentMode =
  | "assistant"
  | "orchestrator"
  | "researcher"
  | "executor"
  | "coder"
  | "chat";

interface AgentConfig {
  id: AgentMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const AGENT_MODES: AgentConfig[] = [
  {
    id: "assistant",
    label: "Assistant",
    icon: "grid-outline",
    description: "General conversation",
  },
  {
    id: "orchestrator",
    label: "Orchestrator",
    icon: "git-branch-outline",
    description: "Multi-agent coordination",
  },
  {
    id: "researcher",
    label: "Researcher",
    icon: "search-outline",
    description: "Deep research",
  },
  {
    id: "executor",
    label: "Executor",
    icon: "flash-outline",
    description: "Task execution",
  },
  {
    id: "coder",
    label: "Coder",
    icon: "code-slash-outline",
    description: "Code generation",
  },
  {
    id: "chat",
    label: "Chat",
    icon: "chatbubble-outline",
    description: "Simple chat",
  },
];

interface AgentSwitcherProps {
  currentAgent: AgentMode;
  onSelectAgent: (agent: AgentMode) => void;
  disabled?: boolean;
}

export function AgentSwitcher({
  currentAgent,
  onSelectAgent,
  disabled = false,
}: AgentSwitcherProps) {
  const theme = useVoidTheme();

  return (
    <View style={[styles.container, { height: 80 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {AGENT_MODES.map((mode) => (
          <AgentModeItem
            key={mode.id}
            config={mode}
            isSelected={currentAgent === mode.id}
            onSelect={() => {
              if (!disabled) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectAgent(mode.id);
              }
            }}
            disabled={disabled}
            theme={theme}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface AgentModeItemProps {
  config: AgentConfig;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
  theme: ReturnType<typeof useVoidTheme>;
}

function AgentModeItem({
  config,
  isSelected,
  onSelect,
  disabled,
  theme,
}: AgentModeItemProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!reduceMotion) {
      scale.value = withSpring(0.95, theme.animation.spring.default);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(
      isSelected ? 1.05 : 1,
      theme.animation.spring.default
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onSelect}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled }}
      accessibilityLabel={`${config.label} mode. ${config.description}`}
    >
      <Animated.View
        style={[
          styles.item,
          {
            backgroundColor: isSelected
              ? theme.colors.glass.hover
              : "transparent",
            opacity: disabled ? 0.5 : 1,
          },
          animatedStyle,
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              borderColor: isSelected
                ? theme.colors.biolum.standard
                : theme.colors.biolum.whisper,
            },
          ]}
        >
          <Ionicons
            name={config.icon}
            size={20}
            color={
              isSelected ? theme.colors.biolum.full : theme.colors.biolum.dim
            }
          />
        </View>
        <BiolumText
          variant="caption"
          size="small"
          color={isSelected ? "standard" : "faint"}
          style={styles.label}
        >
          {config.label}
        </BiolumText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  item: {
    width: 64,
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 4,
  },
});

export default AgentSwitcher;
