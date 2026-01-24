import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { FlatList, StyleSheet, View, RefreshControl } from "react-native";

import { BiolumText, CaptionText } from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { EmptyState } from "@/components/utility/EmptyState";
import { useToast } from "@/contexts/toast";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { trpc } from "@/utils/trpc";

export default function RemindersScreen() {
  const theme = useVoidTheme();
  const toast = useToast();

  const {
    data: reminders,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.remind.list.useQuery({ limit: 50, offset: 0 });

  const fireMutation = trpc.remind.fire.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Reminder marked as fired");
    },
    onError: (error: { message: string }) => {
      toast.error("Failed to update reminder", error.message);
    },
  });

  const renderItem = ({
    item,
  }: {
    item: NonNullable<typeof reminders>[number];
  }) => {
    const isFired = !!item.fired;
    const dueDate = item.due ? new Date(item.due) : null;
    const isOverdue = dueDate && dueDate < new Date() && !isFired;

    return (
      <HUDSurface elevation={1} style={styles.card}>
        <View style={styles.cardHeader}>
          <FluidButton
            icon={
              <Ionicons
                name={isFired ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={
                  isFired
                    ? theme.colors.semantic.success
                    : theme.colors.biolum.dim
                }
              />
            }
            variant="ghost"
            size="small"
            onPress={() => {
              if (!isFired) {
                fireMutation.mutate({ id: item.id });
              }
            }}
            disabled={isFired}
          />
          <View style={styles.cardContent}>
            <BiolumText
              variant="body"
              size="large"
              color={isFired ? "dim" : "full"}
              style={isFired ? styles.completedText : undefined}
            >
              {item.title}
            </BiolumText>
            {item.description && (
              <CaptionText size="medium" color="dim" numberOfLines={1}>
                {item.description}
              </CaptionText>
            )}
          </View>
        </View>

        {dueDate && (
          <View style={styles.dueDate}>
            <Ionicons
              name="alarm-outline"
              size={14}
              color={
                isOverdue
                  ? theme.colors.semantic.error
                  : theme.colors.biolum.faint
              }
            />
            <CaptionText
              size="small"
              color="faint"
              style={{
                marginLeft: 4,
                color: isOverdue ? theme.colors.semantic.error : undefined,
              }}
            >
              {dueDate.toLocaleDateString()} at{" "}
              {dueDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </CaptionText>
          </View>
        )}
      </HUDSurface>
    );
  };

  if (!isLoading && (!reminders || reminders.length === 0)) {
    return (
      <VoidContainer gradient="ambient" noise={true} style={styles.container}>
        <EmptyState
          icon="alarm-outline"
          title="No reminders"
          message="Your reminders will appear here"
          actionLabel="Create Reminder"
          onAction={() =>
            toast.info(
              "Coming soon",
              "Reminder creation will be available soon"
            )
          }
        />
      </VoidContainer>
    );
  }

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      <FlatList
        data={reminders ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.biolum.standard}
          />
        }
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      <FluidButton
        icon={
          <Ionicons name="add" size={24} color={theme.colors.biolum.full} />
        }
        variant="primary"
        size="large"
        onPress={() =>
          toast.info("Coming soon", "Reminder creation will be available soon")
        }
        style={styles.fab}
      />
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardContent: {
    flex: 1,
    marginLeft: 8,
  },
  completedText: {
    textDecorationLine: "line-through",
  },
  dueDate: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginLeft: 40,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
  },
});
