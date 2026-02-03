/**
 * TriageModal Component
 *
 * Bottom sheet for triaging a capture into note, reminder, or archive.
 */

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";

import {
  BiolumText,
  CaptionText,
  TitleText,
  HUDSurface,
  FluidButton,
} from "@/components/foundation";
import { BottomSheet } from "@/components/navigation";
import { useVoidTheme } from "@/hooks/use-void-theme";

import type { Capture } from "./CaptureCard";

export interface TriageOptions {
  title?: string;
  dueDate?: Date;
}

interface TriageModalProps {
  visible: boolean;
  capture: Capture | null;
  onClose: () => void;
  onConvert: (type: "note" | "reminder", options?: TriageOptions) => void;
  onArchive: () => void;
  isLoading?: boolean;
}

type TriageMode = "select" | "reminder";

export function TriageModal({
  visible,
  capture,
  onClose,
  onConvert,
  onArchive,
  isLoading = false,
}: TriageModalProps) {
  const theme = useVoidTheme();
  const [mode, setMode] = useState<TriageMode>("select");
  const [reminderDate, setReminderDate] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0);
    return date;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleClose = useCallback(() => {
    setMode("select");
    setShowDatePicker(false);
    onClose();
  }, [onClose]);

  const handleNotePress = useCallback(() => {
    if (isLoading) {
      return;
    }
    onConvert("note");
    handleClose();
  }, [isLoading, onConvert, handleClose]);

  const handleReminderSelect = useCallback(() => {
    setMode("reminder");
  }, []);

  const handleReminderConfirm = useCallback(() => {
    if (isLoading) {
      return;
    }
    onConvert("reminder", { dueDate: reminderDate });
    handleClose();
  }, [isLoading, onConvert, reminderDate, handleClose]);

  const handleArchivePress = useCallback(() => {
    if (isLoading) {
      return;
    }
    onArchive();
    handleClose();
  }, [isLoading, onArchive, handleClose]);

  const handleBackToSelect = useCallback(() => {
    setMode("select");
    setShowDatePicker(false);
  }, []);

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      setShowDatePicker(false);
      if (selectedDate) {
        setReminderDate(selectedDate);
      }
    },
    []
  );

  const handleShowDatePicker = useCallback(() => {
    setShowDatePicker(true);
  }, []);

  const handleSetOneHour = useCallback(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    setReminderDate(date);
  }, []);

  const handleSetTonight = useCallback(() => {
    const date = new Date();
    date.setHours(20, 0, 0, 0);
    if (date < new Date()) {
      date.setDate(date.getDate() + 1);
    }
    setReminderDate(date);
  }, []);

  const handleSetTomorrow = useCallback(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    setReminderDate(date);
  }, []);

  if (!capture) {
    return null;
  }

  // Truncate content for preview
  const preview =
    capture.content.length > 150
      ? `${capture.content.slice(0, 150)}...`
      : capture.content;

  const formatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={handleClose}
      snapPoints={mode === "reminder" ? ["60%"] : ["50%"]}
    >
      <View style={styles.container}>
        {mode === "select" ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <TitleText size="medium" color="full">
                Triage Capture
              </TitleText>
            </View>

            {/* Content Preview */}
            <HUDSurface elevation={0} style={styles.previewCard}>
              <CaptionText
                size="small"
                color="faint"
                style={styles.previewLabel}
              >
                Captured content
              </CaptionText>
              <BiolumText variant="body" size="small" color="standard">
                {preview}
              </BiolumText>
            </HUDSurface>

            {/* Action Buttons */}
            <View style={styles.actionsGrid}>
              <Pressable
                onPress={handleNotePress}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.actionCard,
                  { backgroundColor: theme.colors.glass.surface },
                  pressed && styles.actionCardPressed,
                  isLoading && styles.actionCardDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Create note from capture"
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: "rgba(0, 217, 255, 0.15)" },
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={28}
                    color="#00D9FF"
                  />
                </View>
                <BiolumText variant="body" size="medium" color="bright">
                  Create Note
                </BiolumText>
                <CaptionText size="small" color="dim" style={styles.actionHint}>
                  Save as a note
                </CaptionText>
              </Pressable>

              <Pressable
                onPress={handleReminderSelect}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.actionCard,
                  { backgroundColor: theme.colors.glass.surface },
                  pressed && styles.actionCardPressed,
                  isLoading && styles.actionCardDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Create reminder from capture"
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: "rgba(0, 255, 136, 0.15)" },
                  ]}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={28}
                    color="#00FF88"
                  />
                </View>
                <BiolumText variant="body" size="medium" color="bright">
                  Create Reminder
                </BiolumText>
                <CaptionText size="small" color="dim" style={styles.actionHint}>
                  Set a due date
                </CaptionText>
              </Pressable>
            </View>

            {/* Archive Button */}
            <FluidButton
              label="Archive"
              variant="ghost"
              size="medium"
              icon={
                <Ionicons
                  name="archive-outline"
                  size={18}
                  color={theme.colors.biolum.faint}
                />
              }
              onPress={handleArchivePress}
              disabled={isLoading}
              style={styles.archiveButton}
            />

            {/* Cancel Button */}
            <FluidButton
              label="Cancel"
              variant="ghost"
              size="medium"
              onPress={handleClose}
              disabled={isLoading}
              style={styles.cancelButton}
            />
          </>
        ) : (
          <>
            {/* Reminder Mode Header */}
            <View style={styles.header}>
              <Pressable
                onPress={handleBackToSelect}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.colors.biolum.standard}
                />
              </Pressable>
              <TitleText size="medium" color="full">
                Set Reminder
              </TitleText>
              <View style={styles.backButton} />
            </View>

            {/* Date Selection */}
            <HUDSurface elevation={1} style={styles.dateCard}>
              <CaptionText size="small" color="faint" style={styles.dateLabel}>
                Remind me at
              </CaptionText>
              <Pressable
                onPress={handleShowDatePicker}
                style={({ pressed }) => [
                  styles.dateSelector,
                  pressed && styles.dateSelectorPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Select reminder date and time"
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={theme.colors.biolum.bright}
                />
                <BiolumText variant="body" size="medium" color="bright">
                  {formatDate(reminderDate)}
                </BiolumText>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.biolum.faint}
                />
              </Pressable>
            </HUDSurface>

            {showDatePicker && (
              <DateTimePicker
                value={reminderDate}
                mode="datetime"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date()}
                themeVariant="dark"
              />
            )}

            {/* Quick Time Options */}
            <View style={styles.quickTimes}>
              <CaptionText size="small" color="faint" style={styles.quickLabel}>
                Quick options
              </CaptionText>
              <View style={styles.quickButtons}>
                <FluidButton
                  label="1 hour"
                  variant="secondary"
                  size="small"
                  onPress={handleSetOneHour}
                  style={styles.quickButton}
                />
                <FluidButton
                  label="Tonight"
                  variant="secondary"
                  size="small"
                  onPress={handleSetTonight}
                  style={styles.quickButton}
                />
                <FluidButton
                  label="Tomorrow"
                  variant="secondary"
                  size="small"
                  onPress={handleSetTomorrow}
                  style={styles.quickButton}
                />
              </View>
            </View>

            {/* Confirm Button */}
            <FluidButton
              label={isLoading ? "Creating..." : "Create Reminder"}
              variant="primary"
              size="large"
              onPress={handleReminderConfirm}
              disabled={isLoading}
              style={styles.confirmButton}
            />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCard: {
    padding: 12,
    marginBottom: 20,
  },
  previewLabel: {
    marginBottom: 8,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  actionCardPressed: {
    opacity: 0.8,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionHint: {
    marginTop: 4,
    textAlign: "center",
  },
  archiveButton: {
    marginBottom: 8,
  },
  cancelButton: {
    marginTop: 4,
  },
  dateCard: {
    padding: 16,
    marginBottom: 20,
  },
  dateLabel: {
    marginBottom: 12,
  },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  dateSelectorPressed: {
    opacity: 0.7,
  },
  quickTimes: {
    marginBottom: 20,
  },
  quickLabel: {
    marginBottom: 12,
  },
  quickButtons: {
    flexDirection: "row",
    gap: 8,
  },
  quickButton: {
    flex: 1,
  },
  confirmButton: {
    marginTop: "auto",
  },
});

export default TriageModal;
