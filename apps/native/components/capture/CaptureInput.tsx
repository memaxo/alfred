/**
 * CaptureInput Component
 *
 * Voice-first capture with text fallback using BiolumOrb.
 */

import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";

import { TextInput as VoidTextInput } from "@/components/form/TextInput";
import {
  BiolumOrb,
  BiolumText,
  CaptionText,
  HUDSurface,
  FluidButton,
} from "@/components/foundation";

interface CaptureInputProps {
  onCapture: (content: string, type: "voice" | "text") => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

export function CaptureInput({
  onCapture,
  isRecording,
  onStartRecording,
  onStopRecording,
  disabled = false,
}: CaptureInputProps) {
  const [textInput, setTextInput] = useState("");

  const handleOrbPress = useCallback(() => {
    if (disabled) {
      return;
    }
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  }, [disabled, isRecording, onStartRecording, onStopRecording]);

  const handleTextSubmit = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed || disabled) {
      return;
    }
    onCapture(trimmed, "text");
    setTextInput("");
  }, [textInput, disabled, onCapture]);

  return (
    <View style={styles.container}>
      {/* Voice Capture with BiolumOrb */}
      <HUDSurface elevation={1} style={styles.voiceSection}>
        <Pressable
          onPress={handleOrbPress}
          disabled={disabled}
          style={styles.orbContainer}
          accessibilityRole="button"
          accessibilityLabel={
            isRecording ? "Stop recording" : "Start voice capture"
          }
          accessibilityHint="Tap to record a voice note"
        >
          <BiolumOrb size={120} pulsing={true} active={isRecording} />
        </Pressable>

        <CaptionText
          size="medium"
          color={isRecording ? "bright" : "dim"}
          style={styles.voiceLabel}
        >
          {isRecording ? "Tap to stop recording" : "Tap to speak"}
        </CaptionText>

        {isRecording && (
          <BiolumText
            variant="body"
            size="small"
            color="standard"
            style={styles.recordingHint}
          >
            Listening...
          </BiolumText>
        )}
      </HUDSurface>

      {/* Text Input Alternative */}
      <HUDSurface elevation={1} style={styles.textSection}>
        <VoidTextInput
          label="Quick capture"
          value={textInput}
          onChange={setTextInput}
          placeholder="Quick capture..."
          multiline
          numberOfLines={3}
          style={styles.textInput}
          editable={!disabled && !isRecording}
        />
        <FluidButton
          label="Capture"
          variant="secondary"
          size="medium"
          onPress={handleTextSubmit}
          disabled={disabled || isRecording || textInput.trim().length === 0}
          style={styles.captureButton}
        />
      </HUDSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  voiceSection: {
    padding: 24,
    alignItems: "center",
  },
  orbContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  voiceLabel: {
    marginTop: 16,
    textAlign: "center",
  },
  recordingHint: {
    marginTop: 8,
    textAlign: "center",
  },
  textSection: {
    padding: 16,
  },
  textLabel: {
    marginBottom: 8,
  },
  textInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  captureButton: {
    marginTop: 12,
    alignSelf: "flex-end",
  },
});

export default CaptureInput;
