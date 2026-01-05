/**
 * Bookmarks List Screen
 *
 * Displays all bookmarks with search and filtering.
 */

import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import {
  useBookmarkCreate,
  useBookmarkDelete,
  useBookmarkList,
} from "@/hooks/use-trpc";
import { haptics } from "@/lib/haptics";

export default function BookmarksListScreen() {
  const _router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const bookmarksQuery = useBookmarkList({
    limit: 100,
    offset: 0,
  });

  const createMutation = useBookmarkCreate({
    onSuccess: () => {
      bookmarksQuery.refetch();
      setUrlInput("");
    },
  });

  const deleteMutation = useBookmarkDelete({
    onSuccess: () => {
      bookmarksQuery.refetch();
    },
  });

  useEffect(() => {
    if (bookmarksQuery.data) {
      setHasMore(bookmarksQuery.data.length === limit);
    }
  }, [bookmarksQuery.data, limit]);

  const handleLoadMore = useCallback(() => {
    if (!bookmarksQuery.isLoading && hasMore && !searchQuery.trim()) {
      setOffset((prev) => prev + limit);
    }
  }, [bookmarksQuery.isLoading, hasMore, searchQuery, limit]);

  const handleCreate = useCallback(() => {
    if (!urlInput.trim()) {
      haptics.error();
      return;
    }
    haptics.success();
    createMutation.mutate({
      url: urlInput.trim(),
    });
  }, [urlInput, createMutation]);

  const handleDelete = useCallback(
    (bookmarkId: string) => {
      haptics.medium();
      Alert.alert(
        "Delete Bookmark",
        "Are you sure you want to delete this bookmark?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate({ id: bookmarkId }),
          },
        ]
      );
    },
    [deleteMutation]
  );

  const handleOpenUrl = useCallback(async (url: string) => {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    }
  }, []);

  const filteredBookmarks = bookmarksQuery.data?.filter(
    (bookmark: { title: string; url: string; description?: string | null }) => {
      if (!searchQuery.trim()) {
        return true;
      }
      const query = searchQuery.toLowerCase();
      return (
        bookmark.title?.toLowerCase().includes(query) ||
        bookmark.url?.toLowerCase().includes(query) ||
        bookmark.description?.toLowerCase().includes(query)
      );
    }
  );

  return (
    <Container>
      <Stack.Screen
        options={{
          title: "Bookmarks",
        }}
      />

      <View className="flex-1">
        {/* Add bookmark form */}
        <View className="border-border border-b bg-background px-4 py-3">
          <View className="flex-row gap-2">
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              keyboardType="url"
              onChangeText={setUrlInput}
              placeholder="Paste URL to bookmark..."
              placeholderTextColor="#5A6B7D"
              value={urlInput}
            />
            <TouchableOpacity
              className="rounded-lg bg-primary px-4 py-2"
              disabled={createMutation.isPending || !urlInput.trim()}
              onPress={handleCreate}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons color="#FFFFFF" name="add" size={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View className="border-border border-b bg-background px-4 py-3">
          <View className="flex-row items-center rounded-lg border border-border bg-surface px-3 py-2">
            <Ionicons color="#5A6B7D" name="search-outline" size={20} />
            <TextInput
              className="ml-2 flex-1 text-foreground"
              onChangeText={setSearchQuery}
              placeholder="Search bookmarks..."
              placeholderTextColor="#5A6B7D"
              value={searchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons color="#5A6B7D" name="close-circle" size={20} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Bookmarks list */}
        {bookmarksQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#00D9FF" size="large" />
          </View>
        ) : filteredBookmarks && filteredBookmarks.length > 0 ? (
          <FlatList
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            data={filteredBookmarks}
            keyExtractor={(item) => item.id}
            ListFooterComponent={
              bookmarksQuery.isLoading && offset > 0 ? (
                <View className="py-4">
                  <ActivityIndicator color="#00D9FF" size="small" />
                </View>
              ) : null
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                onRefresh={() => {
                  setOffset(0);
                  bookmarksQuery.refetch();
                }}
                refreshing={bookmarksQuery.isRefetching}
              />
            }
            renderItem={({ item }) => (
              <View className="mb-3 rounded-lg border border-border bg-card p-4">
                <View className="mb-2 flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text
                      accessibilityRole="header"
                      className="mb-1 font-semibold text-foreground text-lg"
                    >
                      {item.title || "Untitled Bookmark"}
                    </Text>
                    {item.description ? (
                      <Text
                        className="mb-2 text-muted-foreground text-sm"
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      accessibilityLabel={`Open ${item.url}`}
                      accessibilityRole="link"
                      className="flex-row items-center gap-1"
                      onPress={() => handleOpenUrl(item.url)}
                    >
                      <Ionicons color="#00D9FF" name="link-outline" size={14} />
                      <Text className="text-primary text-xs" numberOfLines={1}>
                        {item.url}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="Delete bookmark"
                    accessibilityRole="button"
                    className="ml-2"
                    onPress={() => handleDelete(item.id)}
                  >
                    <Ionicons color="#FF3366" name="trash-outline" size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons color="#5A6B7D" name="bookmark-outline" size={48} />
            <Text className="mt-4 text-center text-lg text-muted-foreground">
              {searchQuery
                ? "No bookmarks match your search"
                : "No bookmarks yet. Add your first bookmark above!"}
            </Text>
          </View>
        )}
      </View>
    </Container>
  );
}
