import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { StyleSheet, View, Pressable, Linking } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";

export interface CiteProps {
  url: string;
  title?: string;
  description?: string;
  domain?: string;
  favicon?: string;
}

export function Cite({ url, title, description, domain }: CiteProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayDomain = domain ?? extractDomain(url);

  const handlePress = () => {
    setExpanded(!expanded);
  };

  const handleOpenUrl = () => {
    Linking.openURL(url);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const contentHeight = useAnimatedStyle(() => ({
    maxHeight: withTiming(expanded ? 200 : 0, { duration: 200 }),
    opacity: withTiming(expanded ? 1 : 0, { duration: 200 }),
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.glass.surface,
          borderColor: theme.colors.glass.border,
        },
      ]}
    >
      <Pressable onPress={handlePress} style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="link-outline"
            size={16}
            color={theme.colors.biolum.dim}
          />
        </View>
        <View style={styles.titleContainer}>
          <BiolumText
            variant="body"
            size="small"
            color="standard"
            numberOfLines={1}
          >
            {title ?? displayDomain}
          </BiolumText>
          <CaptionText size="small" color="faint" numberOfLines={1}>
            {displayDomain}
          </CaptionText>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.colors.biolum.faint}
        />
      </Pressable>

      <Animated.View style={[styles.expandedContent, contentHeight]}>
        {description && (
          <CaptionText size="medium" color="dim" style={styles.description}>
            {description}
          </CaptionText>
        )}
        <CaptionText
          size="small"
          color="faint"
          numberOfLines={2}
          selectable
          style={styles.url}
        >
          {url}
        </CaptionText>
        <View style={styles.actions}>
          <Pressable onPress={handleOpenUrl} style={styles.actionButton}>
            <Ionicons
              name="open-outline"
              size={16}
              color={theme.colors.biolum.dim}
            />
            <CaptionText size="small" color="dim">
              Open
            </CaptionText>
          </Pressable>
          <Pressable onPress={handleCopy} style={styles.actionButton}>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={16}
              color={
                copied ? theme.colors.semantic.success : theme.colors.biolum.dim
              }
            />
            <CaptionText size="small" color={copied ? "standard" : "dim"}>
              {copied ? "Copied!" : "Copy"}
            </CaptionText>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    gap: 2,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    overflow: "hidden",
  },
  description: {
    marginBottom: 8,
  },
  url: {
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
});

export default Cite;
