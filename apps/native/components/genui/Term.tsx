import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useRef, useEffect } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { MonoText, CaptionText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";

export interface TermProps {
  content: string;
  title?: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: number;
  autoScroll?: boolean;
  copyable?: boolean;
}

export function Term({
  content,
  title,
  language,
  showLineNumbers = true,
  maxHeight = 300,
  autoScroll = true,
  copyable = true,
}: TermProps) {
  const theme = useVoidTheme();
  const scrollRef = useRef<ScrollView>(null);

  const lines = content.split("\n");

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [content, autoScroll]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <HUDSurface elevation={1} style={styles.container}>
      {(title || copyable) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {title && (
              <CaptionText size="medium" color="dim">
                {title}
              </CaptionText>
            )}
            {language && (
              <View
                style={[
                  styles.languageBadge,
                  { backgroundColor: theme.colors.glass.surface },
                ]}
              >
                <CaptionText size="small" color="faint">
                  {language}
                </CaptionText>
              </View>
            )}
          </View>
          {copyable && (
            <Pressable
              onPress={handleCopy}
              style={styles.copyButton}
              accessibilityLabel="Copy to clipboard"
            >
              <Ionicons
                name="copy-outline"
                size={16}
                color={theme.colors.biolum.dim}
              />
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={[styles.scrollView, { maxHeight }]}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
      >
        <View style={styles.content}>
          {showLineNumbers && (
            <View style={styles.lineNumbers}>
              {lines.map((_, index) => (
                <MonoText
                  key={index}
                  size="small"
                  color="whisper"
                  style={styles.lineNumber}
                >
                  {String(index + 1).padStart(3, " ")}
                </MonoText>
              ))}
            </View>
          )}
          <View style={styles.codeContent}>
            {lines.map((line, index) => (
              <MonoText
                key={index}
                size="small"
                color="standard"
                selectable
                style={styles.codeLine}
              >
                {line || " "}
              </MonoText>
            ))}
          </View>
        </View>
      </ScrollView>
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  languageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  copyButton: {
    padding: 4,
  },
  scrollView: {
    flexGrow: 0,
  },
  content: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  lineNumbers: {
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "flex-end",
  },
  lineNumber: {
    lineHeight: 18,
  },
  codeContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  codeLine: {
    lineHeight: 18,
  },
});

export default Term;
