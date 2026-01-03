/**
 * New Note Screen
 *
 * Create a new note.
 */

import { Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { useNoteCreate } from "@/hooks/use-trpc";

export default function NewNoteScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const createMutation = useNoteCreate({
    onSuccess: (note: any) => {
      router.replace(`library/notes/${note.id}`);
    },
  });

  const handleSave = useCallback(() => {
    if (!content.trim()) {
      return;
    }
    createMutation.mutate({
      title: title.trim() || undefined,
      content: content.trim(),
      tags: tags.length > 0 ? tags : undefined,
    });
  }, [title, content, tags, createMutation]);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      setTags(tags.filter((t) => t !== tagToRemove));
    },
    [tags]
  );

  return (
    <Container>
      <Stack.Screen
        options={{
          title: "New Note",
          headerRight: () => (
            <TouchableOpacity
              className="mr-4"
              disabled={createMutation.isPending || !content.trim()}
              onPress={handleSave}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#00D9FF" size="small" />
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
          placeholder="Title (optional)"
          placeholderTextColor="#5A6B7D"
          value={title}
        />
        <TextInput
          className="mb-4 min-h-[300px] rounded-lg border border-border bg-surface p-3 text-foreground"
          multiline
          onChangeText={setContent}
          placeholder="Note content..."
          placeholderTextColor="#5A6B7D"
          textAlignVertical="top"
          value={content}
        />
        <View className="mb-4">
          <Text className="mb-2 font-semibold text-foreground">Tags</Text>
          <View className="flex-row flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <View
                className="flex-row items-center gap-1 rounded-full bg-primary/20 px-3 py-1"
                key={idx}
              >
                <Text className="text-primary text-sm">{tag}</Text>
                <TouchableOpacity onPress={() => handleRemoveTag(tag)}>
                  <Text className="text-primary text-sm">×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View className="mt-2 flex-row gap-2">
            <TextInput
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              onChangeText={setTagInput}
              onSubmitEditing={handleAddTag}
              placeholder="Add tag..."
              placeholderTextColor="#5A6B7D"
              value={tagInput}
            />
            <TouchableOpacity
              className="rounded-lg bg-primary px-4 py-2"
              onPress={handleAddTag}
            >
              <Text className="font-semibold text-primary-foreground">Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
