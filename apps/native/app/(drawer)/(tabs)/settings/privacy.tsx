/**
 * Privacy Screen
 *
 * View and manage privacy settings and data.
 */

import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";

export default function PrivacyScreen() {
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);

  const factsQuery = (trpc.privacy as any).facts.useQuery();
  const eventsQuery = (trpc.privacy as any).events.useQuery();

  const deleteFactMutation = (trpc.privacy as any).deleteFact.useMutation({
    onSuccess: () => {
      factsQuery.refetch();
    },
  });

  const purgeMutation = (trpc.privacy as any).purge.useMutation({
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
          onPress: () => deleteFactMutation.mutate({ factId }),
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
    <Container>
      <Stack.Screen
        options={{
          title: "Privacy & Data",
        }}
      />

      <View className="flex-1">
        {/* Purge button */}
        <View className="border-border border-b bg-background px-4 py-4">
          <TouchableOpacity
            className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3"
            disabled={purgeMutation.isPending}
            onPress={handlePurge}
          >
            {purgeMutation.isPending ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator color="#FF3366" size="small" />
                <Text className="font-semibold text-destructive">
                  Purging...
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-center gap-2">
                <Ionicons color="#FF3366" name="trash-outline" size={20} />
                <Text className="font-semibold text-destructive">
                  Purge All Data
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Facts list */}
        <View className="flex-1">
          <View className="border-border border-b bg-background px-4 py-2">
            <Text className="font-semibold text-foreground">Stored Facts</Text>
          </View>
          {factsQuery.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#00FF88" size="large" />
            </View>
          ) : (
            <FlatList
              className="flex-1"
              contentContainerStyle={{ padding: 16 }}
              data={factsQuery.data ?? []}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View className="items-center justify-center p-8">
                  <Ionicons color="#5A6B7D" name="shield-outline" size={48} />
                  <Text className="mt-4 text-center text-lg text-muted-foreground">
                    No facts stored
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  onRefresh={() => factsQuery.refetch()}
                  refreshing={factsQuery.isRefetching}
                />
              }
              renderItem={({ item }) => (
                <View className="mb-3 rounded-lg border border-border bg-card p-4">
                  <View className="mb-2 flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="mb-1 font-semibold text-foreground">
                        {item.fact ?? "Unknown"}
                      </Text>
                      {item.metadata ? (
                        <Text className="text-muted-foreground text-xs">
                          {JSON.stringify(item.metadata)}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteFact(item.id)}>
                      <Ionicons
                        color="#FF3366"
                        name="trash-outline"
                        size={18}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Container>
  );
}
