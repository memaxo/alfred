import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  FlatList,
  StyleSheet,
  View,
  RefreshControl,
  Pressable,
} from "react-native";

import { BiolumText, CaptionText } from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { EmptyState } from "@/components/utility/EmptyState";
import { useToast } from "@/contexts/toast";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { trpc } from "@/utils/trpc";

export default function NotesScreen() {
  const theme = useVoidTheme();
  const toast = useToast();

  const {
    data: notes,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.note.list.useQuery({ limit: 50, offset: 0 });

  const renderItem = ({
    item,
  }: {
    item: NonNullable<typeof notes>[number];
  }) => {
    const preview =
      item.content.slice(0, 100) + (item.content.length > 100 ? "..." : "");
    const date = item.updated
      ? new Date(item.updated).toLocaleDateString()
      : "Unknown";

    return (
      <Pressable
        onPress={() => toast.info("Note selected", item.title ?? "Untitled")}
      >
        <HUDSurface elevation={1} style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.colors.glass.surface },
              ]}
            >
              <Ionicons
                name="document-text"
                size={20}
                color={theme.colors.biolum.standard}
              />
            </View>
            <View style={styles.cardContent}>
              <BiolumText
                variant="body"
                size="large"
                color="full"
                numberOfLines={1}
              >
                {item.title ?? "Untitled Note"}
              </BiolumText>
              <CaptionText size="small" color="faint">
                {date}
              </CaptionText>
            </View>
          </View>
          <BiolumText
            variant="body"
            size="medium"
            color="dim"
            numberOfLines={2}
            style={styles.preview}
          >
            {preview}
          </BiolumText>
        </HUDSurface>
      </Pressable>
    );
  };

  if (!isLoading && (!notes || notes.length === 0)) {
    return (
      <VoidContainer gradient="ambient" noise={true} style={styles.container}>
        <EmptyState
          icon="document-text-outline"
          title="No notes yet"
          message="Your notes will appear here"
          actionLabel="Create Note"
          onAction={() =>
            toast.info("Coming soon", "Note creation will be available soon")
          }
        />
      </VoidContainer>
    );
  }

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      <FlatList
        data={notes ?? []}
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
          toast.info("Coming soon", "Note creation will be available soon")
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
    alignItems: "center",
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  preview: {
    marginTop: 4,
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
