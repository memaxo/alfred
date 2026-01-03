/**
 * Preferences Screen
 *
 * Manage app preferences via tRPC.
 */

import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";

export default function PreferencesScreen() {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const preferencesQuery = (trpc.preference as any).list.useQuery({
    limit: 100,
    offset: 0,
  });

  const setPreferenceMutation = (trpc.preference as any).set.useMutation({
    onSuccess: () => {
      preferencesQuery.refetch();
      setEditingKey(null);
      setEditValue("");
    },
  });

  const deletePreferenceMutation = (trpc.preference as any).delete.useMutation({
    onSuccess: () => {
      preferencesQuery.refetch();
    },
  });

  const handleSave = useCallback(
    (key: string) => {
      setPreferenceMutation.mutate({
        key,
        value: editValue,
      });
    },
    [editValue, setPreferenceMutation]
  );

  const handleDelete = useCallback(
    (key: string) => {
      deletePreferenceMutation.mutate({ key });
    },
    [deletePreferenceMutation]
  );

  return (
    <Container>
      <Stack.Screen
        options={{
          title: "Preferences",
        }}
      />

      {preferencesQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00D9FF" size="large" />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          data={preferencesQuery.data ?? []}
          keyExtractor={(item) => item.key}
          refreshControl={
            <RefreshControl
              onRefresh={() => preferencesQuery.refetch()}
              refreshing={preferencesQuery.isRefetching}
            />
          }
          renderItem={({ item }) => (
            <View className="mb-3 rounded-lg border border-border bg-card p-4">
              <View className="mb-2 flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="mb-1 font-semibold text-foreground">
                    {item.key}
                  </Text>
                  {editingKey === item.key ? (
                    <View className="mt-2 flex-row gap-2">
                      <TextInput
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                        onChangeText={setEditValue}
                        value={editValue}
                      />
                      <TouchableOpacity
                        className="rounded-lg bg-primary px-3 py-2"
                        onPress={() => handleSave(item.key)}
                      >
                        <Text className="text-primary-foreground">Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="rounded-lg border border-border px-3 py-2"
                        onPress={() => {
                          setEditingKey(null);
                          setEditValue("");
                        }}
                      >
                        <Text className="text-foreground">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text className="text-muted-foreground text-sm">
                      {typeof item.value === "string"
                        ? item.value
                        : JSON.stringify(item.value)}
                    </Text>
                  )}
                </View>
                {editingKey !== item.key && (
                  <View className="ml-2 flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        setEditingKey(item.key);
                        setEditValue(
                          typeof item.value === "string"
                            ? item.value
                            : JSON.stringify(item.value)
                        );
                      }}
                    >
                      <Ionicons
                        color="#00D9FF"
                        name="create-outline"
                        size={18}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.key)}>
                      <Ionicons
                        color="#FF3366"
                        name="trash-outline"
                        size={18}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}
    </Container>
  );
}
