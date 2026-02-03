import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function NoteWindow({ window, onClose }: WindowComponentProps) {
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const utils = trpc.useUtils();

  const noteId = asString((window.data as Record<string, unknown>).noteId);
  const query = trpc.note.get.useQuery(
    { id: noteId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: noteId !== null }
  );

  const createMutation = trpc.note.create.useMutation({
    onSuccess: async () => {
      await utils.note.list.invalidate();
    },
  });
  const updateMutation = trpc.note.update.useMutation({
    onSuccess: async () => {
      await utils.note.list.invalidate();
      if (noteId) {
        await utils.note.get.invalidate({ id: noteId });
      }
    },
  });
  const deleteMutation = trpc.note.delete.useMutation({
    onSuccess: async () => {
      await utils.note.list.invalidate();
    },
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const initRef = useRef<string | null>(null);

  const isBusy =
    query.isLoading ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  useEffect(() => {
    if (!noteId) {
      initRef.current = null;
      return;
    }
    const { data } = query;
    if (!data) {
      return;
    }
    if (initRef.current === noteId) {
      return;
    }
    initRef.current = noteId;
    setTitle(typeof data.title === "string" ? data.title : "");
    setContent(typeof data.content === "string" ? data.content : "");
  }, [noteId, query.data]);

  const effectiveTitle = useMemo(() => {
    const t = title.trim();
    return t.length > 0 ? t : "Untitled";
  }, [title]);

  const canSave = content.trim().length > 0 && !isBusy;

  const onSave = () => {
    const t = title.trim();
    const c = content.trim();
    if (!c) {
      Alert.alert("Missing content", "Note content cannot be empty.");
      return;
    }
    if (!noteId) {
      createMutation.mutate(
        {
          title: t.length > 0 ? t : undefined,
          content: c,
        },
        {
          onSuccess: (created) => {
            updateWindowData(window.id, {
              label: effectiveTitle,
              noteId: created.id,
            });
          },
        }
      );
      return;
    }
    updateMutation.mutate({
      id: noteId,
      title: t.length > 0 ? t : undefined,
      content: c,
    });
    updateWindowData(window.id, { label: effectiveTitle });
  };

  const onDelete = () => {
    if (!noteId) {
      onClose();
      return;
    }
    Alert.alert("Delete note", "Delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteMutation.mutate(
            { id: noteId },
            {
              onSuccess: () => {
                onClose();
              },
            }
          );
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">
          {noteId ? "Note" : "New note"}
        </Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          {noteId ? noteId : "Not saved yet"}
        </Text>
      </View>

      {query.isLoading ? (
        <View className="py-8">
          <ActivityIndicator color="#00D9FF" />
        </View>
      ) : query.error ? (
        <View className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <Text className="text-destructive text-sm">
            {query.error.message || "Failed to load note"}
          </Text>
        </View>
      ) : (
        <View className="rounded-lg border border-border bg-card p-4">
          <Text className="font-medium text-foreground text-sm">Title</Text>
          <TextInput
            className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            editable={!isBusy}
            onChangeText={setTitle}
            placeholder="Optional title"
            placeholderTextColor="#6b7280"
            value={title}
          />

          <Text className="mt-4 font-medium text-foreground text-sm">
            Content
          </Text>
          <TextInput
            className="mt-2 min-h-[160px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
            editable={!isBusy}
            multiline
            onChangeText={setContent}
            placeholder="Write your note…"
            placeholderTextColor="#6b7280"
            textAlignVertical="top"
            value={content}
          />

          <View className="mt-4 flex-row gap-2">
            <TouchableOpacity
              className={[
                "flex-1 items-center justify-center rounded-md px-3 py-2",
                canSave ? "bg-primary" : "bg-muted",
              ].join(" ")}
              disabled={!canSave}
              onPress={onSave}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="font-medium text-primary-foreground text-sm">
                  Save
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="items-center justify-center rounded-md bg-destructive/10 px-4 py-2"
              disabled={isBusy}
              onPress={onDelete}
            >
              <Text className="font-medium text-destructive text-sm">
                {noteId ? "Delete" : "Close"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
