import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function NotesWindow(_props: WindowComponentProps) {
  const openWindow = useDesktopStore((s) => s.openWindow);
  const query = trpc.note.list.useQuery({ limit: 100, offset: 0 });

  const notes = useMemo(() => query.data ?? [], [query.data]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-foreground text-sm">Notes</Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              Create and edit notes.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Create note"
            className="rounded-md bg-primary px-4 py-2"
            onPress={() => openWindow("note", { label: "New note" })}
          >
            <Text className="font-medium text-primary-foreground text-sm">
              New
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Recent</Text>
        {query.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : notes.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No notes yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {notes.map((n) => {
              const title =
                typeof n.title === "string" && n.title.trim().length > 0
                  ? n.title
                  : "Untitled";
              const snippet =
                typeof n.content === "string"
                  ? n.content.trim().slice(0, 120)
                  : "";
              return (
                <TouchableOpacity
                  className="rounded-md border border-border bg-background p-3"
                  key={n.id}
                  onPress={() =>
                    openWindow("note", {
                      label: title,
                      noteId: n.id,
                    })
                  }
                >
                  <Text className="font-medium text-foreground text-sm">
                    {title}
                  </Text>
                  <Text
                    className="mt-1 text-muted-foreground text-xs"
                    numberOfLines={2}
                  >
                    {snippet.length > 0 ? snippet : "No content"}
                  </Text>
                  <Text className="mt-1 text-[10px] text-muted-foreground">
                    {n.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
