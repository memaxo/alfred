import React from "react";
import { View, StyleSheet } from "react-native";

import { TitleText, CaptionText } from "@/components/foundation/BiolumText";
import { HUDSurface } from "@/components/foundation/HUDSurface";

import { StepCard, WorkflowStep } from "./StepCard";

interface ExecutionTimelineProps {
  steps: WorkflowStep[];
  currentStep: number;
}

export function ExecutionTimeline({
  steps,
  currentStep,
}: ExecutionTimelineProps) {
  if (steps.length === 0) {
    return (
      <HUDSurface elevation={1} style={styles.emptyContainer}>
        <CaptionText color="dim">No execution steps recorded</CaptionText>
      </HUDSurface>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TitleText size="small">Execution Timeline</TitleText>
        <CaptionText mono color="dim">
          {currentStep + 1} / {steps.length}
        </CaptionText>
      </View>

      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            index={index}
            isActive={index === currentStep}
            isLast={index === steps.length - 1}
            step={step}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  timeline: {
    paddingLeft: 4,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ExecutionTimeline;
