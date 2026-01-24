import React, { useRef, useEffect } from "react";
import { StyleSheet, View, ScrollView, ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";

export interface TranscriptEntry {
  id: string;
  speaker: "user" | "assistant";
  text: string;
  timestamp?: string;
  isPartial?: boolean;
}

export interface TranscriptStreamProps {
  entries: TranscriptEntry[];
  currentText?: string;
  autoScroll?: boolean;
  maxHeight?: number;
  style?: ViewStyle;
}

export function TranscriptStream({
  entries,
  currentText,
  autoScroll = true,
  maxHeight = 200,
  style,
}: TranscriptStreamProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: !reduceMotion });
    }
  }, [entries, currentText, autoScroll, reduceMotion]);

  return (
    <View style={[styles.container, { maxHeight }, style]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {entries.map((entry) => (
          <Animated.View
            key={entry.id}
            entering={!reduceMotion ? FadeIn.duration(200) : undefined}
            style={styles.entryContainer}
          >
            <View style={styles.speakerRow}>
              <CaptionText
                size="small"
                color={entry.speaker === "user" ? "dim" : "faint"}
              >
                {entry.speaker === "user" ? "You" : "Alfred"}
              </CaptionText>
              {entry.timestamp && (
                <CaptionText size="small" color="whisper">
                  {entry.timestamp}
                </CaptionText>
              )}
            </View>
            <BiolumText
              variant="body"
              size="medium"
              color={entry.isPartial ? "dim" : "standard"}
              style={entry.isPartial ? styles.partialText : undefined}
            >
              {entry.text}
            </BiolumText>
          </Animated.View>
        ))}

        {currentText && (
          <Animated.View
            entering={!reduceMotion ? FadeIn.duration(200) : undefined}
            exiting={!reduceMotion ? FadeOut.duration(200) : undefined}
            style={styles.entryContainer}
          >
            <View style={styles.speakerRow}>
              <CaptionText size="small" color="dim">
                You (speaking)
              </CaptionText>
            </View>
            <BiolumText
              variant="body"
              size="medium"
              color="dim"
              style={styles.partialText}
            >
              {currentText}
              <Animated.Text style={styles.cursor}>|</Animated.Text>
            </BiolumText>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
  },
  scrollContent: {
    padding: 12,
    gap: 12,
  },
  entryContainer: {
    gap: 4,
  },
  speakerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  partialText: {
    fontStyle: "italic",
  },
  cursor: {
    opacity: 0.5,
  },
});

export default TranscriptStream;
