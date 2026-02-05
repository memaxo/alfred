import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  AttentionQueue,
  CognitiveStateCard,
  CommitmentsList,
} from "@/components/focus";
import { BiolumOrb } from "@/components/foundation/BiolumOrb";
import { CaptionText, DisplayText } from "@/components/foundation/BiolumText";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { useAuthClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

type CognitivePhase =
  | "idle"
  | "capturing"
  | "thinking"
  | "deciding"
  | "executing"
  | "reflecting";

interface CognitiveState {
  _: CognitivePhase;
  physiology?: {
    energy: number;
    stress: number;
    focus: number;
    load: number;
  };
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const STATE_CONFIG: Record<
  CognitivePhase,
  { label: string; description: string; icon: IconName; color: string }
> = {
  idle: {
    label: "Resting",
    description: "Taking a moment to recharge",
    icon: "moon-outline",
    color: "rgba(255, 255, 255, 0.4)",
  },
  capturing: {
    label: "Processing",
    description: "Absorbing new information",
    icon: "download-outline",
    color: "#00D9FF",
  },
  thinking: {
    label: "Thinking",
    description: "Working through ideas",
    icon: "help-circle-outline",
    color: "#00D9FF",
  },
  deciding: {
    label: "Deciding",
    description: "Evaluating options",
    icon: "git-compare-outline",
    color: "#FFB800",
  },
  executing: {
    label: "Executing",
    description: "Taking action",
    icon: "flash-outline",
    color: "#00FF88",
  },
  reflecting: {
    label: "Learning",
    description: "Reviewing and improving",
    icon: "school-outline",
    color: "#A855F7",
  },
};

function getPhysiologyFromState(state: unknown) {
  const typedState = state as CognitiveState | null | undefined;
  if (!typedState?.physiology) {
    return {
      energy: 0.7,
      stress: 0.3,
      focus: 0.8,
      load: 0.4,
    };
  }
  return typedState.physiology;
}

export default function FocusScreen() {
  const authClient = useAuthClient();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const utils = trpc.useUtils();

  // Fetch cognitive state
  const cognitiveState = trpc.cognitive.state.useQuery({ streamId: "default" });

  // Fetch attention items
  const attention = trpc.attention.list.useQuery({
    status: "open",
    limit: 50,
  });

  // Fetch commitments
  const commitments = trpc.focus.commitmentList.useQuery({
    status: "active",
    limit: 20,
  });

  // Resolve attention mutation
  const resolveAttention = trpc.attention.resolve.useMutation({
    onSuccess: async () => {
      await utils.attention.list.invalidate();
    },
  });

  // Update commitment mutation
  const updateCommitment = trpc.focus.commitmentUpdate.useMutation({
    onSuccess: async () => {
      await utils.focus.commitmentList.invalidate();
    },
  });

  const isRefreshing =
    cognitiveState.isRefetching ||
    attention.isRefetching ||
    commitments.isRefetching;

  const refresh = async () => {
    await Promise.all([
      utils.cognitive.state.invalidate(),
      utils.attention.list.invalidate(),
      utils.focus.commitmentList.invalidate(),
    ]);
  };

  // Get current cognitive phase and config
  const rawState = cognitiveState.data?.state;
  const currentPhase: CognitivePhase =
    (rawState as { _?: CognitivePhase } | undefined)?._ ?? "idle";
  const stateConfig = STATE_CONFIG[currentPhase];
  const isInFlow = currentPhase === "executing";

  // Get physiology data
  const physiology = getPhysiologyFromState(rawState);

  // Map attention items to component format
  const attentionItems = useMemo(() => {
    if (!attention.data) {
      return [];
    }
    return attention.data.map((item) => ({
      id: item.id,
      type: (item.kind === "escalation"
        ? "escalation"
        : item.kind === "review"
          ? "review"
          : item.workflowRunId
            ? "workflow"
            : "reminder") as "reminder" | "escalation" | "review" | "workflow",
      title: item.title ?? item.kind,
      urgency: (item.urgency === "critical"
        ? "high"
        : (item.urgency === "normal"
          ? "medium"
          : "low")) as "high" | "medium" | "low",
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    }));
  }, [attention.data]);

  // Map commitments to component format
  const commitmentItems = useMemo(() => {
    if (!commitments.data) {
      return [];
    }
    return commitments.data.map((item) => ({
      id: item.id,
      title: item.title,
      progress: 0,
      completed: item.status === "done",
    }));
  }, [commitments.data]);

  const handleDismissAttention = (id: string) => {
    resolveAttention.mutate({ id });
  };

  const handleActionAttention = (id: string) => {
    const item = attention.data?.find((i) => i.id === id);
    if (item?.workflowRunId) {
      router.push({
        pathname: "/(drawer)/call",
        params: {
          runId: item.workflowRunId,
          resource: `workflow_run:${item.workflowRunId}`,
        },
      });
    }
  };

  const handleCompleteCommitment = (id: string) => {
    updateCommitment.mutate({
      id,
      status: "done",
    });
  };

  if (!session?.user) {
    return <Redirect href="/(drawer)/" />;
  }

  const isLoading =
    cognitiveState.isLoading || attention.isLoading || commitments.isLoading;

  return (
    <VoidContainer gradient="ambient" noise={true} noiseOpacity={0.03}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={isRefreshing}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#00D9FF" size="large" />
            </View>
          ) : (
            <View style={styles.content}>
              {/* Hero: Large orb showing current state */}
              <View style={styles.heroSection}>
                <View style={styles.orbContainer}>
                  <BiolumOrb
                    size={160}
                    pulsing={true}
                    active={isInFlow}
                    style={{ opacity: 0.9 }}
                  />
                  <View style={styles.stateOverlay}>
                    <Ionicons
                      name={stateConfig.icon}
                      size={32}
                      color={stateConfig.color}
                    />
                  </View>
                </View>
                <DisplayText style={{ color: stateConfig.color }}>
                  {stateConfig.label}
                </DisplayText>
                <CaptionText color="dim">{stateConfig.description}</CaptionText>
              </View>

              {/* Physiology meters */}
              <CognitiveStateCard physiology={physiology} />

              {/* Attention queue */}
              <AttentionQueue
                items={attentionItems}
                onDismiss={handleDismissAttention}
                onAction={handleActionAttention}
              />

              {/* Active commitments */}
              <CommitmentsList
                commitments={commitmentItems}
                onComplete={handleCompleteCommitment}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  orbContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  stateOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
