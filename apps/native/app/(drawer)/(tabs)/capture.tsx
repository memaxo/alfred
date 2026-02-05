/**
 * Capture Screen
 *
 * Voice-first capture with BiolumOrb, text fallback, and triage workflow.
 * Captures are sent to the inbox and can be triaged into notes or reminders.
 */

import { FlashList } from "@shopify/flash-list";
import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";

import {
  CaptureInput,
  CaptureCard,
  TriageModal,
  type Capture,
  type QuickAction,
  type TriageOptions,
} from "@/components/capture";
import {
  DisplayText,
  CaptionText,
  HUDSurface,
  VoidContainer,
} from "@/components/foundation";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { ExpoCapture } from "@/lib/voice/capture";
import { trpc } from "@/utils/trpc";

export default function CaptureScreen() {
  const theme = useVoidTheme();
  const [recording, setRecording] = useState(false);
  const [selectedCapture, setSelectedCapture] = useState<Capture | null>(null);
  const [triageModalVisible, setTriageModalVisible] = useState(false);

  const captureRef = useRef<ExpoCapture | null>(null);

  const utils = trpc.useUtils();

  // Fetch inbox items (untriaged captures)
  const inboxQuery = trpc.inbox.list.useQuery(
    { status: "new", limit: 50 },
    { refetchInterval: 30_000 }
  );

  // Create capture mutation
  const createMutation = trpc.capture.create.useMutation({
    onSuccess: () => {
      void utils.inbox.list.invalidate();
      setRecording(false);
    },
    onError: () => {
      setRecording(false);
    },
  });

  // Triage mutation
  const triageMutation = trpc.capture.triage.useMutation({
    onSuccess: () => {
      void utils.inbox.list.invalidate();
      setTriageModalVisible(false);
      setSelectedCapture(null);
    },
  });

  const evidence = useMemo(() => {
    const device = `${Platform.OS}`;
    return {
      capturedAt: new Date().toISOString(),
      device,
      surface: "native" as const,
    };
  }, []);

  // Voice capture handlers
  const handleStartRecording = useCallback(async () => {
    if (createMutation.isPending || recording) {
      return;
    }

    if (!captureRef.current) {
      captureRef.current = new ExpoCapture();
    }

    setRecording(true);
    try {
      await captureRef.current.start();
    } catch {
      setRecording(false);
    }
  }, [createMutation.isPending, recording]);

  const handleStopRecording = useCallback(async () => {
    if (!captureRef.current || !recording) {
      return;
    }

    try {
      const clip = await captureRef.current.stop();
      setRecording(false);
      if (!clip?.audioBase64) {
        return;
      }

      createMutation.mutate({
        payload: {
          kind: "voice",
          audioBase64: clip.audioBase64,
          mimeType: clip.mimeType,
        },
        evidence,
      });
    } catch {
      setRecording(false);
    }
  }, [recording, createMutation, evidence]);

  // Text capture handler
  const handleTextCapture = useCallback(
    (content: string) => {
      createMutation.mutate({
        payload: { kind: "text", text: content },
        evidence,
      });
    },
    [createMutation, evidence]
  );

  // Combined capture handler
  const handleCapture = useCallback(
    (content: string, type: "voice" | "text") => {
      if (type === "text") {
        handleTextCapture(content);
      }
      // Voice captures are handled by start/stop recording
    },
    [handleTextCapture]
  );

  // Card press handler - open triage modal
  const handleCardPress = useCallback((capture: Capture) => {
    setSelectedCapture(capture);
    setTriageModalVisible(true);
  }, []);

  // Quick action handler
  const handleQuickAction = useCallback(
    (capture: Capture, action: QuickAction) => {
      if (action === "archive") {
        // Archive by setting status - currently not in API, treat as no-op
        // In future: triageMutation.mutate({ captureId: capture.id, destination: "archive" });
        return;
      }

      if (action === "note") {
        triageMutation.mutate({
          captureId: capture.id,
          destination: "note",
        });
        return;
      }

      if (action === "reminder") {
        // Open modal for reminder to set due date
        setSelectedCapture(capture);
        setTriageModalVisible(true);
      }
    },
    [triageMutation]
  );

  // Triage modal handlers
  const handleTriageConvert = useCallback(
    (type: "note" | "reminder", options?: TriageOptions) => {
      if (!selectedCapture) {
        return;
      }

      triageMutation.mutate({
        captureId: selectedCapture.id,
        destination: type,
        due: options?.dueDate?.toISOString(),
        title: options?.title,
      });
    },
    [selectedCapture, triageMutation]
  );

  const handleTriageArchive = useCallback(() => {
    // Archive functionality - treat as closing for now
    setTriageModalVisible(false);
    setSelectedCapture(null);
  }, []);

  const handleTriageClose = useCallback(() => {
    setTriageModalVisible(false);
    setSelectedCapture(null);
  }, []);

  // Transform inbox items to Capture format
  const captures: Capture[] = useMemo(() => {
    if (!inboxQuery.data) {
      return [];
    }

    return inboxQuery.data.map((item) => ({
      id: item.capture.id,
      content: item.bundle?.text ?? "",
      type: (item.capture.kind ?? "text") as "voice" | "text" | "photo",
      createdAt: new Date(item.capture.createdAt),
      status: (item.capture.status ?? "new") as Capture["status"],
    }));
  }, [inboxQuery.data]);

  // Render item for FlashList
  const renderItem = useCallback(
    ({ item }: { item: Capture }) => (
      <CaptureCard
        capture={item}
        onPress={() => handleCardPress(item)}
        onQuickAction={(action) => handleQuickAction(item, action)}
      />
    ),
    [handleCardPress, handleQuickAction]
  );

  const keyExtractor = useCallback((item: Capture) => item.id, []);

  const ListHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        {/* Header */}
        <View style={styles.header}>
          <DisplayText size="medium" color="full">
            Capture
          </DisplayText>
          <CaptionText size="medium" color="dim">
            Capture voice or text, then triage
          </CaptionText>
        </View>

        {/* Input Section */}
        <CaptureInput
          onCapture={handleCapture}
          isRecording={recording}
          onStartRecording={() => void handleStartRecording()}
          onStopRecording={() => void handleStopRecording()}
          disabled={createMutation.isPending}
        />

        {/* Recent Captures Header */}
        {captures.length > 0 && (
          <View style={styles.recentHeader}>
            <CaptionText size="medium" color="dim">
              Recent Captures
            </CaptionText>
            <CaptionText size="small" color="faint">
              {captures.length} pending
            </CaptionText>
          </View>
        )}
      </View>
    ),
    [
      handleCapture,
      recording,
      handleStartRecording,
      handleStopRecording,
      createMutation.isPending,
      captures.length,
    ]
  );

  const ListEmpty = useCallback(
    () =>
      !inboxQuery.isLoading ? (
        <HUDSurface style={styles.emptyState}>
          <CaptionText size="medium" color="dim" style={styles.emptyText}>
            No captures yet
          </CaptionText>
          <CaptionText size="small" color="faint" style={styles.emptyHint}>
            Tap the orb to record a voice note
          </CaptionText>
        </HUDSurface>
      ) : null,
    [inboxQuery.isLoading]
  );

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      <Stack.Screen
        options={{
          title: "Capture",
          headerStyle: { backgroundColor: theme.colors.void.deep },
          headerTintColor: theme.colors.biolum.full,
        }}
      />

      <FlashList
        data={captures}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={inboxQuery.isRefetching}
        onRefresh={() => void inboxQuery.refetch()}
      />

      <TriageModal
        visible={triageModalVisible}
        capture={selectedCapture}
        onClose={handleTriageClose}
        onConvert={handleTriageConvert}
        onArchive={handleTriageArchive}
        isLoading={triageMutation.isPending}
      />
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  listHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  header: {
    marginBottom: 24,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    marginBottom: 8,
  },
  emptyHint: {
    textAlign: "center",
  },
});
