import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function BookmarksWindow(_props: WindowComponentProps) {
  const utils = trpc.useUtils();
  const query = trpc.book.list.useQuery({ limit: 100, offset: 0 });
  const create = trpc.book.create.useMutation({
    onSuccess: async () => {
      await utils.book.list.invalidate();
    },
  });
  const del = trpc.book.delete.useMutation({
    onSuccess: async () => {
      await utils.book.list.invalidate();
    },
  });

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const bookmarks = useMemo(() => query.data ?? [], [query.data]);

  const add = () => {
    const u = url.trim();
    if (!u) {
      return;
    }
    create.mutate({
      url: u,
      title: title.trim().length > 0 ? title.trim() : undefined,
    });
    setUrl("");
    setTitle("");
  };

  const remove = (id: string) => {
    Alert.alert("Delete bookmark", "Delete this bookmark?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => del.mutate({ id }),
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Bookmarks</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Save links for later.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setUrl}
          placeholder="https://…"
          placeholderTextColor="#6b7280"
          value={url}
        />
        <TextInput
          className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setTitle}
          placeholder="Optional title"
          placeholderTextColor="#6b7280"
          value={title}
        />
        <TouchableOpacity
          className={[
            "mt-3 items-center justify-center rounded-md px-3 py-2",
            url.trim().length > 0 && !create.isPending
              ? "bg-primary"
              : "bg-muted",
          ].join(" ")}
          disabled={url.trim().length === 0 || create.isPending}
          onPress={add}
        >
          {create.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="font-medium text-primary-foreground text-sm">
              Add
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">List</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {query.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : query.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {query.error.message}
          </Text>
        ) : bookmarks.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No bookmarks yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {bookmarks.map((b) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={b.id}
              >
                <TouchableOpacity
                  accessibilityLabel="Open bookmark"
                  onPress={() => void Linking.openURL(b.url).catch(() => {})}
                >
                  <Text className="font-medium text-foreground text-sm">
                    {b.title ?? b.url}
                  </Text>
                  <Text className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {b.url}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Delete bookmark"
                  className="mt-2 self-start rounded-md bg-destructive/10 px-3 py-2"
                  onPress={() => remove(b.id)}
                >
                  <Text className="text-destructive text-xs">Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
