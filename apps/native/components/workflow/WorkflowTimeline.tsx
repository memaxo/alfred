import React from "react";
import { StyleSheet, View } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";
import { Progress } from "../genui/Progress";
import { Timeline, TimelineItem } from "../genui/Timeline";

export interface WorkflowPhase {
  id: string;
  name: string;
  status: "pending" | "active" | "completed" | "error";
  startTime?: string;
  endTime?: string;
}

export interface WorkflowTimelineProps {
  title: string;
  phases: WorkflowPhase[];
  currentPhase?: string;
  progress?: number;
}

export function WorkflowTimeline({
  title,
  phases,
  currentPhase,
  progress,
}: WorkflowTimelineProps) {
  const theme = useVoidTheme();

  const completedCount = phases.filter((p) => p.status === "completed").length;
  const calculatedProgress = progress ?? (completedCount / phases.length) * 100;

  const timelineItems: TimelineItem[] = phases.map((phase) => ({
    id: phase.id,
    title: phase.name,
    status: phase.status,
    timestamp: phase.startTime,
  }));

  return (
    <HUDSurface elevation={1} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <BiolumText variant="title" size="medium" color="full">
            {title}
          </BiolumText>
          <CaptionText size="medium" color="dim">
            {completedCount}/{phases.length} phases complete
          </CaptionText>
        </View>
        <Progress
          value={calculatedProgress}
          variant="radial"
          size={48}
          showLabel={false}
        />
      </View>
      <View style={styles.timeline}>
        <Timeline items={timelineItems} />
      </View>
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  timeline: {
    marginTop: 8,
  },
});

export default WorkflowTimeline;
