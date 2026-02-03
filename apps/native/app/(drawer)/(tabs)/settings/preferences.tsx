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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
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
  usePreferenceDelete,
  usePreferenceList,
  usePreferenceSet,
} from "@/hooks/use-trpc";

interface PreferenceItemProps {
  item: {
    key: string;
    value?: unknown;
  };
  editingKey: string | null;
  editValue: string;
  onEdit: (key: string, value: string) => void;
  onSave: (key: string) => void;
  onCancel: () => void;
  onDelete: (key: string) => void;
  isSaving: boolean;
  isDeleting: boolean;
}

function PreferenceItem({
  item,
  editingKey,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  isSaving,
  isDeleting,
}: PreferenceItemProps) {
  const isEditing = editingKey === item.key;
  const displayValue =
    typeof item.value === "string" ? item.value : JSON.stringify(item.value);

  return (
    <HUDSurface elevation={1} style={styles.preferenceCard}>
      <View style={styles.preferenceHeader}>
        <BodyText style={styles.preferenceKey}>{item.key}</BodyText>
        {!isEditing && (
          <View style={styles.actions}>
            <Pressable
              onPress={() => onEdit(item.key, displayValue)}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <Ionicons name="create-outline" size={18} color="#00D9FF" />
            </Pressable>
            <Pressable
              onPress={() => onDelete(item.key)}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FF3366" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#FF3366" />
              )}
            </Pressable>
          </View>
        )}
      </View>

      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.input}
            onChangeText={(text) => onEdit(item.key, text)}
            value={editValue}
            placeholder="Enter value..."
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
          <View style={styles.editActions}>
            <Pressable
              onPress={() => onSave(item.key)}
              style={({ pressed }) => [
                styles.actionButton,
                styles.saveButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <BodyText style={styles.saveButtonText}>Save</BodyText>
              )}
            </Pressable>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.actionButton,
                styles.cancelButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <BodyText>Cancel</BodyText>
            </Pressable>
          </View>
        </View>
      ) : (
        <CaptionText color="dim" style={styles.preferenceValue}>
          {displayValue}
        </CaptionText>
      )}
    </HUDSurface>
  );
}

export default function PreferencesScreen() {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const preferencesQuery = usePreferenceList({
    limit: 100,
    offset: 0,
  });

  const setPreferenceMutation = usePreferenceSet({
    onSuccess: () => {
      preferencesQuery.refetch();
      setEditingKey(null);
      setEditValue("");
    },
  });

  const deletePreferenceMutation = usePreferenceDelete({
    onSuccess: () => {
      preferencesQuery.refetch();
    },
  });

  const handleEdit = useCallback((key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  }, []);

  const handleSave = useCallback(
    (key: string) => {
      setPreferenceMutation.mutate({
        key,
        value: editValue,
      });
    },
    [editValue, setPreferenceMutation]
  );

  const handleCancel = useCallback(() => {
    setEditingKey(null);
    setEditValue("");
  }, []);

  const handleDelete = useCallback(
    (key: string) => {
      deletePreferenceMutation.mutate({ key });
    },
    [deletePreferenceMutation]
  );

  return (
    <VoidContainer gradient="ambient" noise={true} noiseOpacity={0.03}>
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Preferences" }} />

        <View style={styles.header}>
          <TitleText size="large">Preferences</TitleText>
          <CaptionText color="dim">Customize assistant behavior</CaptionText>
        </View>

        {preferencesQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#00D9FF" size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                onRefresh={() => preferencesQuery.refetch()}
                refreshing={preferencesQuery.isRefetching}
                tintColor="#00D9FF"
              />
            }
          >
            {preferencesQuery.data?.map((item) => (
              <PreferenceItem
                key={item.key}
                item={item}
                editingKey={editingKey}
                editValue={editValue}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onDelete={handleDelete}
                isSaving={setPreferenceMutation.isPending}
                isDeleting={deletePreferenceMutation.isPending}
              />
            ))}

            {preferencesQuery.data?.length === 0 && (
              <HUDSurface elevation={1} style={styles.emptyCard}>
                <Ionicons
                  name="options-outline"
                  size={48}
                  color="rgba(255,255,255,0.2)"
                />
                <BodyText style={styles.emptyText}>No preferences set</BodyText>
                <CaptionText color="dim">
                  Preferences will appear here when configured
                </CaptionText>
              </HUDSurface>
            )}
          </ScrollView>
        )}
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
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  preferenceCard: {
    marginBottom: 12,
    padding: 16,
  },
  preferenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  preferenceKey: {
    flex: 1,
    fontWeight: "600",
  },
  preferenceValue: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  iconButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  editContainer: {
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 14,
    marginBottom: 12,
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  saveButton: {
    backgroundColor: "#00D9FF",
  },
  saveButtonText: {
    color: "#000",
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
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
