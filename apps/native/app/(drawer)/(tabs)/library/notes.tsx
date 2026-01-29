/**
 * Notes List Screen
 *
 * Displays all user notes with search and filtering.
 */

import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Link, Stack, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { ListSkeleton } from "@/components/loading-skeleton";
import {
  type NoteRouterOutputs,
  useNoteDelete,
  useNoteList,
} from "@/hooks/use-trpc";
import { trackEvent, trackScreen } from "@/lib/analytics";
import { haptics } from "@/lib/haptics";
import { fuzzySearch, type SortOption, sortFunctions } from "@/lib/search";

type NoteItem = NoteRouterOutputs["list"][number];

const sortOptions: SortOption<NoteItem>[] = [
  {
    key: "updated-newest",
    label: "Recently Updated",
    sortFn: sortFunctions.updatedNewest,
  },
  {
    key: "created-newest",
    label: "Newest First",
    sortFn: sortFunctions.dateNewest,
  },
  {
    key: "created-oldest",
    label: "Oldest First",
    sortFn: sortFunctions.dateOldest,
  },
  {
    key: "title-asc",
    label: "Title A-Z",
    sortFn: sortFunctions.titleAsc,
  },
  {
    key: "title-desc",
    label: "Title Z-A",
    sortFn: sortFunctions.titleDesc,
  },
];

export default function NotesListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("updated-newest");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const notesQuery = useNoteList({
    limit,
    offset,
  });

  useEffect(() => {
    if (notesQuery.data) {
      setHasMore(notesQuery.data.length === limit);
    }
  }, [notesQuery.data, limit]);

  const handleLoadMore = useCallback(() => {
    if (!notesQuery.isLoading && hasMore && !searchQuery.trim()) {
      setOffset((prev) => prev + limit);
    }
  }, [notesQuery.isLoading, hasMore, searchQuery, limit]);

  const deleteMutation = useNoteDelete({
    onSuccess: () => {
      notesQuery.refetch();
    },
  });

  useEffect(() => {
    trackScreen("notes");
  }, []);

  const handleDelete = useCallback(
    (noteId: string) => {
      haptics.medium();
      trackEvent("note_deleted", { noteId });
      deleteMutation.mutate({ id: noteId });
    },
    [deleteMutation]
  );

  const renderNoteItem = useCallback(
    ({ item }: { item: NoteItem }) => (
      <MemoizedNoteItem item={item} onDelete={handleDelete} router={router} />
    ),
    [handleDelete, router]
  );

  // Apply fuzzy search
  const searchedNotes = searchQuery.trim()
    ? fuzzySearch(notesQuery.data ?? [], searchQuery, (note) => [
        note.title || "",
        note.content || "",
        ...(note.tags || []),
      ])
    : (notesQuery.data ?? []);

  // Apply sorting
  const sortedNotes = useMemo(() => {
    const sortOption = sortOptions.find((opt) => opt.key === sortBy);
    if (!sortOption) {
      return searchedNotes;
    }
    return [...searchedNotes].sort(sortOption.sortFn);
  }, [searchedNotes, sortBy]);

  return (
    <Container>
      <Stack.Screen
        options={{
          title: "Notes",
          headerRight: () => (
            <Pressable
              className="mr-4"
              onPress={() => router.push("/library/notes/new")}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Ionicons color="#00D9FF" name="add" size={24} />
            </Pressable>
          ),
        }}
      />

      <View className="flex-1">
        {/* Search and sort bar */}
        <View className="border-border border-b bg-background px-4 py-3">
          <View className="mb-2 flex-row items-center rounded-lg border border-border bg-surface px-3 py-2">
            <Ionicons color="#5A6B7D" name="search-outline" size={20} />
            <TextInput
              accessibilityLabel="Search notes"
              accessibilityRole="search"
              className="ml-2 flex-1 text-foreground"
              onChangeText={setSearchQuery}
              placeholder="Search notes..."
              placeholderTextColor="#5A6B7D"
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() => setSearchQuery("")}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Ionicons color="#5A6B7D" name="close-circle" size={20} />
              </Pressable>
            ) : null}
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons color="#5A6B7D" name="funnel-outline" size={16} />
            <Text className="text-muted-foreground text-sm">Sort:</Text>
            {sortOptions.map((option) => (
              <Pressable
                accessibilityLabel={`Sort by ${option.label}`}
                accessibilityRole="button"
                className={`rounded-full px-3 py-1 ${
                  sortBy === option.key
                    ? "bg-primary"
                    : "border border-border bg-surface"
                }`}
                key={option.key}
                onPress={() => setSortBy(option.key)}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text
                  className={`text-xs ${
                    sortBy === option.key
                      ? "font-semibold text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notes list */}
        {notesQuery.isLoading ? (
          <View className="flex-1 px-4 py-4">
            <ListSkeleton count={5} />
          </View>
        ) : sortedNotes && sortedNotes.length > 0 ? (
          <FlashList
            className="flex-1"
            contentContainerStyle={styles.listContent}
            data={sortedNotes}
            keyExtractor={(item) => item.id}
            // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
            estimatedItemSize={100}
            ListFooterComponent={
              notesQuery.isLoading && offset > 0 ? (
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
                  notesQuery.refetch();
                }}
                refreshing={notesQuery.isRefetching}
              />
            }
            renderItem={renderNoteItem}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons color="#5A6B7D" name="document-text-outline" size={48} />
            <Text className="mt-4 text-center text-lg text-muted-foreground">
              {searchQuery
                ? "No notes match your search"
                : "No notes yet. Create your first note!"}
            </Text>
            {!searchQuery && (
              <Pressable
                className="mt-4 rounded-lg bg-primary px-6 py-3"
                onPress={() => router.push("library/notes/new")}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text className="font-semibold text-primary-foreground">
                  Create Note
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Container>
  );
}

interface NoteItemProps {
  item: NoteItem;
  onDelete: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}

function NoteItem({ item, onDelete, router }: NoteItemProps) {
  return (
    <Link asChild href={`library/notes/${item.id}`}>
      <Pressable
        accessibilityHint="Double tap to view or edit this note"
        accessibilityLabel={`Note: ${item.title || "Untitled Note"}`}
        accessibilityRole="button"
        className="mb-3 rounded-lg border border-border bg-card p-4"
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        <View className="mb-2 flex-row items-start justify-between">
          <Text
            accessibilityRole="header"
            className="flex-1 font-semibold text-foreground text-lg"
          >
            {item.title || "Untitled Note"}
          </Text>
          <Pressable
            accessibilityHint="Double tap to delete this note"
            accessibilityLabel="Delete note"
            accessibilityRole="button"
            className="ml-2"
            onPress={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Ionicons color="#FF3366" name="trash-outline" size={18} />
          </Pressable>
        </View>
        {item.content ? (
          <Text
            className="mb-2 text-muted-foreground text-sm"
            numberOfLines={2}
          >
            {item.content}
          </Text>
        ) : null}
        {item.tags && item.tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {item.tags.map((tag: string, idx: number) => (
              <View className="rounded-full bg-primary/20 px-2 py-1" key={idx}>
                <Text className="text-primary text-xs">{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {item.updated ? (
          <Text className="mt-2 text-muted-foreground/60 text-xs">
            {new Date(item.updated).toLocaleDateString()}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

const MemoizedNoteItem = memo(
  NoteItem,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.onDelete === next.onDelete &&
    prev.router === next.router
);

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
});
