import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import type { Review } from "./ReviewCard";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ReviewDetailsModalProps {
  review: Review | null;
  visible: boolean;
  onClose: () => void;
  onApprove: (review: Review) => void;
  onReject: (review: Review) => void;
}

const REVIEW_TYPE_LABELS: Record<Review["reviewType"], string> = {
  tool_execution: "Tool Execution",
  message: "Message Quality",
  memory: "Memory Association",
  workflow: "Workflow Decision",
  code: "Code Review",
};

export function ReviewDetailsModal({
  review,
  visible,
  onClose,
  onApprove,
  onReject,
}: ReviewDetailsModalProps) {
  const theme = useVoidTheme();

  if (!review) return null;

  const handleApprove = () => {
    onApprove(review);
    onClose();
  };

  const handleReject = () => {
    onReject(review);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View style={styles.modalContainer}>
          <HUDSurface elevation={3} style={styles.modal}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.header}>
              <BiolumText color="full" size="large" variant="title">
                Review Details
              </BiolumText>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <BiolumText color="dim" size="medium" variant="title">
                  ✕
                </BiolumText>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollContent}
            >
              {/* Review Type Section */}
              <View style={styles.section}>
                <BiolumText color="faint" size="large" variant="caption">
                  TYPE
                </BiolumText>
                <BiolumText
                  color="bright"
                  size="large"
                  style={styles.sectionContent}
                  variant="body"
                >
                  {REVIEW_TYPE_LABELS[review.reviewType]}
                </BiolumText>
              </View>

              {/* Priority Section */}
              <View style={styles.section}>
                <BiolumText color="faint" size="large" variant="caption">
                  PRIORITY
                </BiolumText>
                <View style={styles.priorityRow}>
                  <View
                    style={[
                      styles.priorityDot,
                      {
                        backgroundColor:
                          review.priority === "critical"
                            ? theme.colors.semantic.error
                            : review.priority === "high"
                              ? theme.colors.semantic.warning
                              : review.priority === "medium"
                                ? theme.colors.semantic.info
                                : theme.colors.biolum.dim,
                      },
                    ]}
                  />
                  <BiolumText color="bright" size="large" variant="body">
                    {review.priority.charAt(0).toUpperCase() +
                      review.priority.slice(1)}
                  </BiolumText>
                </View>
              </View>

              {/* Content Section */}
              <View style={styles.section}>
                <BiolumText color="faint" size="large" variant="caption">
                  DETAILS
                </BiolumText>
                <View style={styles.contentBox}>
                  {renderReviewContent(review)}
                </View>
              </View>

              {/* Confidence Section */}
              {review.confidence !== undefined && (
                <View style={styles.section}>
                  <BiolumText color="faint" size="large" variant="caption">
                    CONFIDENCE
                  </BiolumText>
                  <View style={styles.confidenceRow}>
                    <View style={styles.confidenceBarBg}>
                      <View
                        style={[
                          styles.confidenceBarFill,
                          { width: `${review.confidence * 100}%` },
                        ]}
                      />
                    </View>
                    <BiolumText color="standard" size="medium" variant="body">
                      {Math.round(review.confidence * 100)}%
                    </BiolumText>
                  </View>
                </View>
              )}

              {/* Context Section */}
              {review.context && (
                <View style={styles.section}>
                  <BiolumText color="faint" size="large" variant="caption">
                    CONTEXT
                  </BiolumText>
                  <BiolumText
                    color="dim"
                    size="medium"
                    style={styles.sectionContent}
                    variant="body"
                  >
                    {review.context.conversationId
                      ? `From conversation: ${review.context.conversationId.slice(0, 8)}...`
                      : "No additional context"}
                  </BiolumText>
                </View>
              )}

              {/* Timestamp */}
              <View style={styles.section}>
                <BiolumText color="faint" size="large" variant="caption">
                  CREATED
                </BiolumText>
                <BiolumText
                  color="dim"
                  size="medium"
                  style={styles.sectionContent}
                  variant="body"
                >
                  {formatDate(review.createdAt)}
                </BiolumText>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={handleReject}
                style={[styles.actionButton, styles.rejectButton]}
              >
                <BiolumText color="full" size="large" variant="body">
                  ✕ Reject
                </BiolumText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleApprove}
                style={[styles.actionButton, styles.approveButton]}
              >
                <BiolumText color="full" size="large" variant="body">
                  ✓ Approve
                </BiolumText>
              </TouchableOpacity>
            </View>
          </HUDSurface>
        </View>
      </View>
    </Modal>
  );
}

function renderReviewContent(review: Review) {
  const { subjectData, reviewType } = review;

  switch (reviewType) {
    case "tool_execution":
      return (
        <>
          <BiolumText color="bright" size="large" variant="body">
            {subjectData.toolName || "Unknown Tool"}
          </BiolumText>
          {subjectData.summary && (
            <BiolumText
              color="standard"
              size="medium"
              style={{ marginTop: 8 }}
              variant="body"
            >
              {subjectData.summary}
            </BiolumText>
          )}
        </>
      );

    case "memory":
      return (
        <>
          <BiolumText color="bright" size="large" variant="body">
            Learned Preference
          </BiolumText>
          <BiolumText
            color="standard"
            size="medium"
            style={{ marginTop: 8 }}
            variant="body"
          >
            "{subjectData.memoryFact}"
          </BiolumText>
        </>
      );

    case "message":
      return (
        <>
          <BiolumText color="bright" size="large" variant="body">
            Response Quality
          </BiolumText>
          <BiolumText
            color="standard"
            numberOfLines={10}
            size="medium"
            style={{ marginTop: 8 }}
            variant="body"
          >
            {subjectData.messageContent}
          </BiolumText>
        </>
      );

    case "workflow":
      return (
        <>
          <BiolumText color="bright" size="large" variant="body">
            Decision: {subjectData.workflowDecision}
          </BiolumText>
          {subjectData.summary && (
            <BiolumText
              color="standard"
              size="medium"
              style={{ marginTop: 8 }}
              variant="body"
            >
              {subjectData.summary}
            </BiolumText>
          )}
        </>
      );

    case "code":
      return (
        <>
          <BiolumText color="bright" size="large" variant="body">
            {subjectData.prTitle || `PR #${subjectData.prNumber}`}
          </BiolumText>
          {subjectData.bugCount !== undefined && (
            <BiolumText
              color={subjectData.bugCount > 0 ? "full" : "dim"}
              size="medium"
              style={{ marginTop: 8 }}
              variant="body"
            >
              {subjectData.bugCount > 0
                ? `🔴 ${subjectData.bugCount} bugs detected`
                : "✓ No bugs detected"}
            </BiolumText>
          )}
          {subjectData.summary && (
            <BiolumText
              color="standard"
              size="medium"
              style={{ marginTop: 8 }}
              variant="body"
            >
              {subjectData.summary}
            </BiolumText>
          )}
        </>
      );

    default:
      return (
        <BiolumText color="dim" size="medium" variant="body">
          No additional details available
        </BiolumText>
      );
  }
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  modal: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  section: {
    marginBottom: 20,
  },
  sectionContent: {
    marginTop: 8,
  },
  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  contentBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 12,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  confidenceBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    marginRight: 12,
    overflow: "hidden",
  },
  confidenceBarFill: {
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 4,
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  rejectButton: {
    backgroundColor: "rgba(255, 100, 100, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 100, 100, 0.3)",
  },
  approveButton: {
    backgroundColor: "rgba(100, 255, 100, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(100, 255, 100, 0.3)",
  },
});

export default ReviewDetailsModal;
