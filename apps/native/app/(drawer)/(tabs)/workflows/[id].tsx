/**
 * Workflow Detail Screen
 *
 * View workflow details with execution progress, step status, variables,
 * and approve/reject actions for workflows awaiting review.
 */

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { BiolumOrb, CaptionText, TitleText } from "@/components/foundation";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import {
  ExecutionTimeline,
  VariableInspector,
  type WorkflowStep,
} from "@/components/workflow";
import { useWorkflowGet } from "@/hooks/use-trpc";
import { trpc } from "@/utils/trpc";

const STATUS_COLORS: Record<string, string> = {
  pending: "#FFB800",
  running: "#00D9FF",
  completed: "#00FF88",
  failed: "#FF4444",
  suspended: "#FFB800",
  cancelled: "#8B8B8B",
};

const STATUS_ICONS: Record<
  string,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  pending: "hourglass-outline",
  running: "sync",
  completed: "checkmark-circle",
  failed: "close-circle",
  suspended: "pause-circle",
  cancelled: "ban",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

// Convert workflow events to steps
function parseWorkflowEvents(events: unknown[]): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const stepMap = new Map<string, WorkflowStep>();

  if (!Array.isArray(events)) return steps;

  for (const event of events) {
    if (!event || typeof event !== "object") continue;

    const e = event as Record<string, unknown>;
    const eventType = String(e.eventType ?? "");
    const stepId = String(e.stepId ?? e.eventId ?? "");
    const timestamp = e.timestamp ? new Date(String(e.timestamp)) : new Date();
    const eventData = e.eventData as Record<string, unknown> | undefined;

    if (!stepId) continue;

    if (eventType === "stage-enter" || eventType === "step-start") {
      const step: WorkflowStep = {
        id: stepId,
        name: String(eventData?.stage ?? eventData?.name ?? stepId),
        status: "running",
        startedAt: timestamp,
      };
      stepMap.set(stepId, step);
      steps.push(step);
    } else if (eventType === "stage-exit" || eventType === "step-complete") {
      const step = stepMap.get(stepId);
      if (step) {
        step.status = "success";
        step.completedAt = timestamp;
      }
    } else if (eventType === "stage-error" || eventType === "step-error") {
      const step = stepMap.get(stepId);
      if (step) {
        step.status = "failed";
        step.completedAt = timestamp;
        step.error = String(eventData?.error ?? "Unknown error");
      }
    }
  }

  return steps;
}

export default function WorkflowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const workflowQuery = useWorkflowGet({ runId: id ?? "" });
  const workflow = workflowQuery.data;

  // Get workflow events
  const eventsQuery = trpc.workflow.events.useQuery(
    { runId: id ?? "" },
    { enabled: Boolean(id) }
  );

  // Parse events into steps
  const steps = useMemo(() => {
    if (!eventsQuery.data) return [];
    return parseWorkflowEvents(eventsQuery.data);
  }, [eventsQuery.data]);

  // Find current step index
  const currentStepIndex = useMemo(() => {
    if (steps.length === 0) return -1;
    const runningIndex = steps.findIndex((s) => s.status === "running");
    if (runningIndex >= 0) return runningIndex;
    const pendingIndex = steps.findIndex((s) => s.status === "pending");
    if (pendingIndex >= 0) return pendingIndex;
    return steps.length - 1;
  }, [steps]);

  const isRunning = workflow?.status === "running";
  const statusColor = STATUS_COLORS[workflow?.status ?? "pending"];
  const statusIcon = STATUS_ICONS[workflow?.status ?? "pending"];
  const statusText = STATUS_LABELS[workflow?.status ?? "pending"];

  if (workflowQuery.isLoading) {
    return (
      <VoidContainer gradient="ambient" noise noiseOpacity={0.03}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#00D9FF" size="large" />
          </View>
        </SafeAreaView>
      </VoidContainer>
    );
  }

  if (!workflow && id) {
    return (
      <VoidContainer gradient="ambient" noise noiseOpacity={0.03}>
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#FF4444" />
            <TitleText style={styles.errorText}>Workflow not found</TitleText>
          </View>
        </SafeAreaView>
      </VoidContainer>
    );
  }

  return (
    <VoidContainer gradient="ambient" noise noiseOpacity={0.03}>
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Workflow Details" }} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Header with status */}
          <View style={styles.header}>
            <View style={styles.statusOrb}>
              <BiolumOrb size={60} pulsing={isRunning} active={isRunning} />
              <View style={styles.statusIconContainer}>
                <Ionicons name={statusIcon} size={24} color={statusColor} />
              </View>
            </View>
            <View style={styles.headerText}>
              <TitleText style={styles.workflowName}>
                {workflow?.requirement ?? "Workflow"}
              </TitleText>
              <CaptionText color="dim" style={styles.workflowId}>
                {workflow?.id}
              </CaptionText>
              <CaptionText mono style={{ fontSize: 12, color: statusColor }}>
                {statusText}
              </CaptionText>
            </View>
          </View>

          {/* Execution timeline */}
          <ExecutionTimeline steps={steps} currentStep={currentStepIndex} />

          {/* Variable inspector - show state data as variables */}
          <VariableInspector
            variables={(workflow?.stateData as Record<string, unknown>) ?? {}}
          />
        </ScrollView>
      </SafeAreaView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusOrb: {
    position: "relative",
    marginRight: 16,
  },
  statusIconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  workflowName: {
    marginBottom: 4,
  },
  workflowId: {
    marginBottom: 4,
  },
});
