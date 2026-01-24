/**
 * Note Detail/Edit Screen
 *
 * View and edit a single note.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { useNoteDelete, useNoteGet, useNoteUpdate } from "@/hooks/use-trpc";
import { generateShareLink } from "@/lib/linking";

export default function NoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const noteQuery = useNoteGet({ id: id ?? "" }, { enabled: !!id });

  const updateMutation = useNoteUpdate();

  useEffect(() => {
    if (updateMutation.isSuccess) {
      noteQuery.refetch();
      setIsEditing(false);
    }
  }, [updateMutation.isSuccess, noteQuery]);

  const deleteMutation = useNoteDelete({
    onSuccess: () => {
      router.back();
    },
  });

  useEffect(() => {
    if (noteQuery.data) {
      setTitle(noteQuery.data.title ?? "");
      setContent(noteQuery.data.content ?? "");
      setTags(noteQuery.data.tags ?? []);
    }
  }, [noteQuery.data]);

  const handleSave = useCallback(() => {
    if (!id) {
      return;
    }
    updateMutation.mutate({
      id,
      title: title.trim() || undefined,
      content: content.trim(),
      tags: tags.length > 0 ? tags : undefined,
    });
  }, [id, title, content, tags, updateMutation]);

  const handleShare = useCallback(async () => {
    if (!id) {
      return;
    }
    const shareUrl = generateShareLink("note", id);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUrl);
      } else {
        // Fallback: copy to clipboard
        await Clipboard.setStringAsync(shareUrl);
        Alert.alert("Link Copied", "Note link has been copied to clipboard");
      }
    } catch (_error) {
      // Fallback to clipboard
      await Clipboard.setStringAsync(shareUrl);
      Alert.alert("Link Copied", "Note link has been copied to clipboard");
    }
  }, [id]);

  const handleDelete = useCallback(() => {
    if (!id) {
      return;
    }
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate({ id }),
      },
    ]);
  }, [id, deleteMutation]);

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

  if (noteQuery.isLoading) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00D9FF" size="large" />
        </View>
      </Container>
    );
  }

  if (!noteQuery.data) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-lg text-muted-foreground">
            Note not found
          </Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <Stack.Screen
        options={{
          title: isEditing ? "Edit Note" : "Note",
          headerRight: () => (
            <View className="flex-row items-center gap-4">
              {isEditing ? (
                <>
                  <TouchableOpacity onPress={() => setIsEditing(false)}>
                    <Text className="text-muted-foreground">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={updateMutation.isPending}
                    onPress={handleSave}
                  >
                    {updateMutation.isPending ? (
                      <ActivityIndicator color="#00D9FF" size="small" />
                    ) : (
                      <Text className="text-primary">Save</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={handleShare}>
                    <Ionicons color="#00D9FF" name="share-outline" size={22} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <Ionicons color="#00D9FF" name="create-outline" size={22} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete}>
                    <Ionicons color="#FF3366" name="trash-outline" size={22} />
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
              placeholder="Title (optional)"
              placeholderTextColor="#5A6B7D"
              value={title}
            />
            <TextInput
              className="mb-4 min-h-[200px] rounded-lg border border-border bg-surface p-3 text-foreground"
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
                      <Ionicons color="#00D9FF" name="close-circle" size={16} />
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
                  <Text className="font-semibold text-primary-foreground">
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <>
            {title ? (
              <Text className="mb-4 font-bold text-2xl text-foreground">
                {title}
              </Text>
            ) : null}
            <Text className="mb-4 text-foreground leading-6">{content}</Text>
            {tags.length > 0 ? (
              <View className="mb-4 flex-row flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <View
                    className="rounded-full bg-primary/20 px-3 py-1"
                    key={idx}
                  >
                    <Text className="text-primary text-sm">{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {noteQuery.data.updated ? (
              <Text className="text-muted-foreground/60 text-xs">
                Updated: {new Date(noteQuery.data.updated).toLocaleString()}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </Container>
  );
}
