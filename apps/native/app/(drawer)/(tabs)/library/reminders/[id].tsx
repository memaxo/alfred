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
import {
  useReminderDelete,
  useReminderFire,
  useReminderList,
} from "@/hooks/use-trpc";

export default function ReminderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [_recurring, setRecurring] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Fetch all reminders and find the one with matching id
  const remindersQuery = useReminderList({ limit: 1000, offset: 0 });
  const reminder = remindersQuery.data?.find((r) => r.id === id) ?? null;

  const deleteMutation = useReminderDelete();
  const fireMutation = useReminderFire();

  useEffect(() => {
    if (deleteMutation.isSuccess) {
      router.back();
    }
  }, [deleteMutation.isSuccess, router]);

  useEffect(() => {
    if (fireMutation.isSuccess) {
      remindersQuery.refetch();
    }
  }, [fireMutation.isSuccess, remindersQuery]);

  useEffect(() => {
    if (reminder) {
      setTitle(reminder.title ?? "");
      setDescription(reminder.description ?? "");
      setDueDate(reminder.due ? new Date(reminder.due) : new Date());
      setRecurring(reminder.recurring ?? "");
    }
  }, [reminder]);

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

  if (remindersQuery.isLoading) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00FF88" size="large" />
        </View>
      </Container>
    );
  }

  if (!reminder && id) {
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
                <TouchableOpacity onPress={() => setIsEditing(false)}>
                  <Text className="text-muted-foreground">Cancel</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {!reminder?.fired && (
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
                  onChange={(_event, selectedDate) => {
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
              {reminder?.title}
            </Text>
            {reminder?.description ? (
              <Text className="mb-4 text-foreground leading-6">
                {reminder.description}
              </Text>
            ) : null}
            <View className="mb-4 flex-row items-center gap-2">
              <Text className="font-semibold text-foreground">Due:</Text>
              <Text className="text-foreground">
                {reminder?.due
                  ? new Date(reminder.due).toLocaleString()
                  : "Not set"}
              </Text>
            </View>
            {reminder?.fired ? (
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
