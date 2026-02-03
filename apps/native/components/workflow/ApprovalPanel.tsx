import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { View, StyleSheet, TextInput, ActivityIndicator } from "react-native";

import {
  TitleText,
  CaptionText,
  BodyText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";

interface Workflow {
  id: string;
  status: string;
  name?: string;
  description?: string | null;
}

interface ApprovalPanelProps {
  workflow: Workflow;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  isLoading?: boolean;
}

export function ApprovalPanel({
  workflow,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalPanelProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleReject = () => {
    if (showRejectInput) {
      onReject(rejectionReason || undefined);
    } else {
      setShowRejectInput(true);
    }
  };

  const handleCancelReject = () => {
    setShowRejectInput(false);
    setRejectionReason("");
  };

  return (
    <HUDSurface elevation={2} glow style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={28} color="#FFB800" />
        </View>
        <View style={styles.headerText}>
          <TitleText size="small" style={styles.title}>
            Approval Required
          </TitleText>
          <CaptionText color="dim">
            Review before continuing execution
          </CaptionText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.summary}>
        <CaptionText color="dim" style={styles.summaryLabel}>
          Workflow
        </CaptionText>
        <BodyText color="bright">{workflow.name || workflow.id}</BodyText>

        {workflow.description && (
          <>
            <CaptionText color="dim" style={{ marginBottom: 4, marginTop: 8 }}>
              Description
            </CaptionText>
            <CaptionText>{workflow.description}</CaptionText>
          </>
        )}
      </View>

      {showRejectInput && (
        <View style={styles.rejectInputContainer}>
          <CaptionText color="dim" style={styles.inputLabel}>
            Rejection reason (optional)
          </CaptionText>
          <TextInput
            style={styles.rejectInput}
            value={rejectionReason}
            onChangeText={setRejectionReason}
            placeholder="Enter reason for rejection..."
            placeholderTextColor="#5A6B7D"
            multiline
            numberOfLines={3}
            editable={!isLoading}
          />
        </View>
      )}

      <View style={styles.actions}>
        {showRejectInput ? (
          <>
            <FluidButton
              label="Cancel"
              variant="ghost"
              size="medium"
              onPress={handleCancelReject}
              disabled={isLoading}
              style={styles.actionButton}
            />
            <FluidButton
              label="Confirm Reject"
              variant="secondary"
              size="medium"
              onPress={handleReject}
              disabled={isLoading}
              style={{ minWidth: 140, borderColor: "rgba(255, 68, 68, 0.5)" }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FF4444" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="close-circle" size={18} color="#FF4444" />
                  <CaptionText style={{ color: "#FF4444", marginLeft: 8 }}>
                    Reject
                  </CaptionText>
                </View>
              )}
            </FluidButton>
          </>
        ) : (
          <>
            <FluidButton
              label="Reject"
              variant="secondary"
              size="medium"
              onPress={handleReject}
              disabled={isLoading}
              style={{ minWidth: 120, borderColor: "rgba(255, 68, 68, 0.5)" }}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="close-circle" size={18} color="#FF4444" />
                <CaptionText style={{ color: "#FF4444", marginLeft: 8 }}>
                  Reject
                </CaptionText>
              </View>
            </FluidButton>
            <FluidButton
              label="Approve"
              variant="primary"
              size="medium"
              onPress={onApprove}
              disabled={isLoading}
              style={{ minWidth: 120, borderColor: "rgba(0, 255, 136, 0.5)" }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#00FF88" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="checkmark-circle" size={18} color="#00FF88" />
                  <CaptionText style={{ color: "#00FF88", marginLeft: 8 }}>
                    Approve
                  </CaptionText>
                </View>
              )}
            </FluidButton>
          </>
        )}
      </View>
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    borderColor: "rgba(255, 184, 0, 0.3)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 184, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: "#FFB800",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 12,
  },
  summary: {
    marginBottom: 16,
  },
  summaryLabel: {
    marginBottom: 4,
  },
  mt8: {
    marginTop: 8,
  },
  rejectInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    marginBottom: 8,
  },
  rejectInput: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontFamily: "monospace",
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.3)",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  actionButton: {
    minWidth: 120,
  },
  approveButton: {
    borderColor: "rgba(0, 255, 136, 0.5)",
  },
  rejectButton: {
    borderColor: "rgba(255, 68, 68, 0.5)",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ApprovalPanel;
