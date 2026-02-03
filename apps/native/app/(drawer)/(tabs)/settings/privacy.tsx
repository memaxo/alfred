/**
 * Privacy Screen
 *
 * View and manage privacy settings and data.
 */

import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  VoidContainer,
  HUDSurface,
  BodyText,
  CaptionText,
  TitleText,
} from "@/components/foundation";
import {
  usePrivacyDeleteFact,
  usePrivacyEvents,
  usePrivacyFacts,
  usePrivacyPurge,
} from "@/hooks/use-trpc";

interface FactItemProps {
  item: {
    id: string;
    content?: string | null;
    category?: string | null;
  };
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function FactItem({ item, onDelete, isDeleting }: FactItemProps) {
  return (
    <HUDSurface elevation={1} style={styles.factCard}>
      <View style={styles.factHeader}>
        <View style={styles.factContent}>
          <BodyText style={styles.factText}>
            {item.content ?? "Unknown"}
          </BodyText>
          {item.category && (
            <CaptionText color="dim" style={styles.categoryText}>
              Category: {item.category}
            </CaptionText>
          )}
        </View>
        <Pressable
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.deleteButtonPressed,
          ]}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#FF3366" />
          ) : (
            <Ionicons name="trash-outline" size={18} color="#FF3366" />
          )}
        </Pressable>
      </View>
    </HUDSurface>
  );
}

export default function PrivacyScreen() {
  const factsQuery = usePrivacyFacts();
  const eventsQuery = usePrivacyEvents();

  const deleteFactMutation = usePrivacyDeleteFact({
    onSuccess: () => {
      factsQuery.refetch();
    },
  });

  const purgeMutation = usePrivacyPurge({
    onSuccess: () => {
      Alert.alert("Success", "All data has been purged");
      factsQuery.refetch();
      eventsQuery.refetch();
    },
  });

  const handleDeleteFact = useCallback(
    (factId: string) => {
      Alert.alert("Delete Fact", "Are you sure you want to delete this fact?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteFactMutation.mutate({ id: factId }),
        },
      ]);
    },
    [deleteFactMutation]
  );

  const handlePurge = useCallback(() => {
    Alert.alert(
      "Purge All Data",
      "This will permanently delete all your stored facts and events. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Purge",
          style: "destructive",
          onPress: () => purgeMutation.mutate(),
        },
      ]
    );
  }, [purgeMutation]);

  return (
    <VoidContainer gradient="ambient" noise={true} noiseOpacity={0.03}>
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Privacy & Data" }} />

        <View style={styles.header}>
          <TitleText size="large">Privacy & Data</TitleText>
          <CaptionText color="dim">
            Control your data and privacy settings
          </CaptionText>
        </View>

        {/* Purge Section */}
        <HUDSurface elevation={2} style={styles.purgeCard}>
          <View style={styles.purgeHeader}>
            <Ionicons name="warning-outline" size={24} color="#FF3366" />
            <BodyText style={styles.purgeTitle}>Purge All Data</BodyText>
          </View>
          <CaptionText color="dim" style={styles.purgeDescription}>
            This will permanently delete all your stored facts and events. This
            action cannot be undone.
          </CaptionText>
          <Pressable
            onPress={handlePurge}
            disabled={purgeMutation.isPending}
            style={({ pressed }) => [
              styles.purgeButton,
              pressed && styles.purgeButtonPressed,
              purgeMutation.isPending && styles.purgeButtonDisabled,
            ]}
          >
            {purgeMutation.isPending ? (
              <View style={styles.purgeButtonContent}>
                <ActivityIndicator size="small" color="#FF3366" />
                <BodyText style={styles.purgeButtonText}>Purging...</BodyText>
              </View>
            ) : (
              <View style={styles.purgeButtonContent}>
                <Ionicons name="trash-outline" size={18} color="#FF3366" />
                <BodyText style={styles.purgeButtonText}>
                  Purge All Data
                </BodyText>
              </View>
            )}
          </Pressable>
        </HUDSurface>

        {/* Facts Section */}
        <View style={styles.section}>
          <CaptionText style={styles.sectionTitle}>STORED FACTS</CaptionText>

          {factsQuery.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#00FF88" size="large" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl
                  onRefresh={() => factsQuery.refetch()}
                  refreshing={factsQuery.isRefetching}
                  tintColor="#00FF88"
                />
              }
            >
              {factsQuery.data?.map((item) => (
                <FactItem
                  key={item.id}
                  item={item}
                  onDelete={handleDeleteFact}
                  isDeleting={deleteFactMutation.isPending}
                />
              ))}

              {factsQuery.data?.length === 0 && (
                <HUDSurface elevation={1} style={styles.emptyCard}>
                  <Ionicons
                    name="shield-outline"
                    size={48}
                    color="rgba(255,255,255,0.2)"
                  />
                  <BodyText style={styles.emptyText}>No facts stored</BodyText>
                  <CaptionText color="dim">
                    Your privacy data will appear here
                  </CaptionText>
                </HUDSurface>
              )}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  purgeCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderColor: "rgba(255, 51, 102, 0.3)",
  },
  purgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  purgeTitle: {
    fontWeight: "600",
    color: "#FF3366",
  },
  purgeDescription: {
    marginBottom: 16,
    lineHeight: 20,
  },
  purgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 51, 102, 0.5)",
    backgroundColor: "rgba(255, 51, 102, 0.1)",
  },
  purgeButtonPressed: {
    backgroundColor: "rgba(255, 51, 102, 0.2)",
  },
  purgeButtonDisabled: {
    opacity: 0.6,
  },
  purgeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  purgeButtonText: {
    color: "#FF3366",
    fontWeight: "600",
  },
  section: {
    flex: 1,
    marginTop: 8,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 8,
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  factCard: {
    marginBottom: 12,
    padding: 16,
  },
  factHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  factContent: {
    flex: 1,
    marginRight: 12,
  },
  factText: {
    lineHeight: 20,
  },
  categoryText: {
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  deleteButtonPressed: {
    backgroundColor: "rgba(255, 51, 102, 0.1)",
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 4,
  },
});
