/**
 * New Reminder Screen
 *
 * Create a new reminder with due date and optional recurrence.
 */

import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { useReminderNotifications } from "@/hooks/use-reminder-notifications";
import { useReminderCreate } from "@/hooks/use-trpc";

export default function NewReminderScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurring, setRecurring] = useState("");

  const createMutation = useReminderCreate();
  useReminderNotifications(createMutation.data ?? null);

  useEffect(() => {
    if (createMutation.isSuccess && createMutation.data) {
      router.replace(`library/reminders/${createMutation.data.id}`);
    }
  }, [createMutation.isSuccess, createMutation.data, router]);

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      due: dueDate.toISOString(),
      recurring: recurring.trim() || undefined,
    });
  }, [title, description, dueDate, recurring, createMutation]);

  return (
    <Container>
      <Stack.Screen
        options={{
          title: "New Reminder",
          headerRight: () => (
            <TouchableOpacity
              className="mr-4"
              disabled={createMutation.isPending || !title.trim()}
              onPress={handleSave}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#00FF88" size="small" />
              ) : (
                <Text className="text-primary">Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
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
          <Text className="mb-2 font-semibold text-foreground">Due Date</Text>
          <TouchableOpacity
            className="rounded-lg border border-border bg-surface p-3"
            onPress={() => setShowDatePicker(true)}
          >
            <Text className="text-foreground">{dueDate.toLocaleString()}</Text>
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

        <View className="mb-4">
          <Text className="mb-2 font-semibold text-foreground">
            Recurrence (optional)
          </Text>
          <TextInput
            className="rounded-lg border border-border bg-surface p-3 text-foreground"
            onChangeText={setRecurring}
            placeholder="e.g., daily, weekly, monthly"
            placeholderTextColor="#5A6B7D"
            value={recurring}
          />
        </View>
      </ScrollView>
    </Container>
  );
}
