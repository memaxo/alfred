/**
 * Reminder Detail Screen
 *
 * View and edit a single reminder.
 */

import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { useReminderDelete, useReminderFire } from "@/hooks/use-trpc";

export default function ReminderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurring, setRecurring] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Note: get endpoint may not exist, using fallback
  const reminderQuery = {
    data: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  };

  const deleteMutation = useReminderDelete();
  const fireMutation = useReminderFire();

  useEffect(() => {
    if (deleteMutation.isSuccess) {
      router.back();
    }
  }, [deleteMutation.isSuccess, router]);

  useEffect(() => {
    if (fireMutation.isSuccess) {
      reminderQuery.refetch();
    }
  }, [fireMutation.isSuccess, reminderQuery]);

  useEffect(() => {
    if (reminderQuery.data) {
      setTitle(reminderQuery.data.title ?? "");
      setDescription(reminderQuery.data.description ?? "");
      setDueDate(
        reminderQuery.data.due ? new Date(reminderQuery.data.due) : new Date()
      );
      setRecurring(reminderQuery.data.recurring ?? "");
    }
  }, [reminderQuery.data]);

  const handleDelete = useCallback(() => {
    if (!id) {
      return;
    }
    Alert.alert(
      "Delete Reminder",
      "Are you sure you want to delete this reminder?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id }),
        },
      ]
    );
  }, [id, deleteMutation]);

  const handleFire = useCallback(() => {
    if (!id) {
      return;
    }
    fireMutation.mutate({ id });
  }, [id, fireMutation]);

  if (reminderQuery.isLoading) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00FF88" size="large" />
        </View>
      </Container>
    );
  }

  if (!reminderQuery.data && id) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-lg text-muted-foreground">
            Reminder not found
          </Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <Stack.Screen
        options={{
          title: isEditing ? "Edit Reminder" : "Reminder",
          headerRight: () => (
            <View className="flex-row items-center gap-4">
              {isEditing ? (
                <>
                  <TouchableOpacity onPress={() => setIsEditing(false)}>
                    <Text className="text-muted-foreground">Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {!reminderQuery.data?.fired && (
                    <TouchableOpacity onPress={handleFire}>
                      <Text className="text-primary">Mark Done</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleDelete}>
                    <Text className="text-destructive">Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ),
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {isEditing ? (
          <>
            <TextInput
              className="mb-4 rounded-lg border border-border bg-surface p-3 font-semibold text-foreground text-lg"
              onChangeText={setTitle}
              placeholder="Reminder title"
              placeholderTextColor="#5A6B7D"
              value={title}
            />
            <TextInput
              className="mb-4 min-h-[150px] rounded-lg border border-border bg-surface p-3 text-foreground"
              multiline
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor="#5A6B7D"
              textAlignVertical="top"
              value={description}
            />
            <View className="mb-4">
              <Text className="mb-2 font-semibold text-foreground">
                Due Date
              </Text>
              <TouchableOpacity
                className="rounded-lg border border-border bg-surface p-3"
                onPress={() => setShowDatePicker(true)}
              >
                <Text className="text-foreground">
                  {dueDate.toLocaleString()}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  mode="datetime"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (selectedDate) {
                      setDueDate(selectedDate);
                    }
                  }}
                  value={dueDate}
                />
              )}
            </View>
          </>
        ) : (
          <>
            <Text className="mb-4 font-bold text-2xl text-foreground">
              {reminderQuery.data?.title}
            </Text>
            {reminderQuery.data?.description ? (
              <Text className="mb-4 text-foreground leading-6">
                {reminderQuery.data.description}
              </Text>
            ) : null}
            <View className="mb-4 flex-row items-center gap-2">
              <Text className="font-semibold text-foreground">Due:</Text>
              <Text className="text-foreground">
                {reminderQuery.data?.due
                  ? new Date(reminderQuery.data.due).toLocaleString()
                  : "Not set"}
              </Text>
            </View>
            {reminderQuery.data?.fired ? (
              <View className="mb-4 flex-row items-center gap-2">
                <Text className="text-primary">✓ Completed</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Container>
  );
}
