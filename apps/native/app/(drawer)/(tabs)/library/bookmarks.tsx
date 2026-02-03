/**
 * Bookmarks List Screen
 *
 * Displays all bookmarks with search and filtering.
 * Styled with ALFRED's "Signal in the Void" design system.
 */

import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import {
  BodyText,
  CaptionText,
  FluidButton,
  HUDSurface,
  VoidContainer,
} from "@/components/foundation";
import {
  useBookmarkCreate,
  useBookmarkDelete,
  useBookmarkList,
} from "@/hooks/use-trpc";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { haptics } from "@/lib/haptics";

type BookmarkItem = NonNullable<
  ReturnType<typeof useBookmarkList>["data"]
>[number];

export default function BookmarksListScreen() {
  const _router = useRouter();
  const theme = useVoidTheme();
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

  const renderBookmarkItem = useCallback(
    ({ item }: { item: BookmarkItem }) => (
      <MemoizedBookmarkItem
        item={item}
        onOpenUrl={handleOpenUrl}
        onDelete={handleDelete}
      />
    ),
    [handleOpenUrl, handleDelete]
  );

  const filteredBookmarks = bookmarksQuery.data?.filter((bookmark) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return (
      bookmark.title?.toLowerCase().includes(query) ||
      bookmark.url?.toLowerCase().includes(query) ||
      bookmark.description?.toLowerCase().includes(query)
    );
  });

  return (
    <VoidContainer gradient="ambient" noise noiseOpacity={0.03}>
      <Stack.Screen
        options={{
          title: "Bookmarks",
          headerStyle: { backgroundColor: theme.colors.void.deep },
          headerTintColor: theme.colors.biolum.bright,
        }}
      />

      <View style={styles.content}>
        {/* Add bookmark form */}
        <View style={styles.addForm}>
          <HUDSurface elevation={1} style={styles.inputRow}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.urlInput, { color: theme.colors.biolum.bright }]}
              keyboardType="url"
              onChangeText={setUrlInput}
              placeholder="Paste URL to bookmark..."
              placeholderTextColor={theme.colors.biolum.faint}
              value={urlInput}
            />
            <FluidButton
              onPress={handleCreate}
              disabled={createMutation.isPending || !urlInput.trim()}
              loading={createMutation.isPending}
              variant="primary"
              size="small"
              icon={
                createMutation.isPending ? (
                  <ActivityIndicator
                    color={theme.colors.biolum.full}
                    size="small"
                  />
                ) : (
                  <Ionicons
                    color={theme.colors.biolum.full}
                    name="add"
                    size={20}
                  />
                )
              }
            />
          </HUDSurface>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <HUDSurface elevation={1} style={styles.searchInputContainer}>
            <Ionicons
              color={theme.colors.biolum.dim}
              name="search-outline"
              size={20}
            />
            <TextInput
              style={[
                styles.searchInput,
                { color: theme.colors.biolum.bright },
              ]}
              onChangeText={setSearchQuery}
              placeholder="Search bookmarks..."
              placeholderTextColor={theme.colors.biolum.faint}
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                {({ pressed }) => (
                  <Ionicons
                    color={theme.colors.biolum.dim}
                    name="close-circle"
                    size={20}
                    style={pressed ? styles.pressed : undefined}
                  />
                )}
              </Pressable>
            ) : null}
          </HUDSurface>
        </View>

        {/* Bookmarks list */}
        {bookmarksQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
          </View>
        ) : filteredBookmarks && filteredBookmarks.length > 0 ? (
          <FlashList
            contentContainerStyle={styles.listContent}
            data={filteredBookmarks}
            keyExtractor={(item) => item.id}
            // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
            estimatedItemSize={100}
            ListFooterComponent={
              bookmarksQuery.isLoading && offset > 0 ? (
                <View style={styles.footer}>
                  <ActivityIndicator
                    color={theme.colors.accent.cyan}
                    size="small"
                  />
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
                tintColor={theme.colors.accent.cyan}
              />
            }
            renderItem={renderBookmarkItem}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              color={theme.colors.biolum.faint}
              name="bookmark-outline"
              size={48}
            />
            <BodyText color="dim" style={styles.emptyText}>
              {searchQuery
                ? "No bookmarks match your search"
                : "No bookmarks yet. Add your first bookmark above!"}
            </BodyText>
          </View>
        )}
      </View>
    </VoidContainer>
  );
}

interface BookmarkItemProps {
  item: BookmarkItem;
  onOpenUrl: (url: string) => void;
  onDelete: (id: string) => void;
}

function BookmarkItem({ item, onOpenUrl, onDelete }: BookmarkItemProps) {
  const theme = useVoidTheme();

  return (
    <HUDSurface elevation={1} style={styles.bookmarkCard}>
      <View style={styles.bookmarkContent}>
        <View style={styles.bookmarkMain}>
          <BodyText
            accessibilityRole="header"
            color="bright"
            style={styles.bookmarkTitle}
            numberOfLines={1}
          >
            {item.title || "Untitled Bookmark"}
          </BodyText>
          {item.description ? (
            <BodyText
              color="dim"
              numberOfLines={2}
              style={styles.bookmarkDescription}
            >
              {item.description}
            </BodyText>
          ) : null}
          <Pressable
            accessibilityLabel={`Open ${item.url}`}
            accessibilityRole="link"
            onPress={() => onOpenUrl(item.url)}
            style={styles.urlContainer}
          >
            {({ pressed }) => (
              <View style={[styles.urlRow, pressed && styles.pressed]}>
                <View
                  style={[
                    styles.faviconPlaceholder,
                    { borderColor: theme.colors.accent.cyan },
                  ]}
                >
                  <Ionicons
                    color={theme.colors.accent.cyan}
                    name="link-outline"
                    size={12}
                  />
                </View>
                <CaptionText
                  mono
                  color="standard"
                  numberOfLines={1}
                  style={styles.urlText}
                >
                  {item.url}
                </CaptionText>
              </View>
            )}
          </Pressable>
        </View>
        <Pressable
          accessibilityLabel="Delete bookmark"
          accessibilityRole="button"
          onPress={() => onDelete(item.id)}
          hitSlop={8}
        >
          {({ pressed }) => (
            <Ionicons
              color={theme.colors.semantic.error}
              name="trash-outline"
              size={20}
              style={pressed ? styles.pressed : undefined}
            />
          )}
        </Pressable>
      </View>
    </HUDSurface>
  );
}

const MemoizedBookmarkItem = memo(
  BookmarkItem,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.onOpenUrl === next.onOpenUrl &&
    prev.onDelete === next.onDelete
);

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  addForm: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    textAlign: "center",
  },
  bookmarkCard: {
    marginBottom: 12,
    padding: 16,
  },
  bookmarkContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  bookmarkMain: {
    flex: 1,
  },
  bookmarkTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  bookmarkDescription: {
    marginBottom: 8,
  },
  urlContainer: {
    marginTop: 4,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  faviconPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  urlText: {
    flex: 1,
  },
});
