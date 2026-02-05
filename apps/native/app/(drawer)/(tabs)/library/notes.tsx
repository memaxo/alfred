/**
 * Notes List Screen
 *
 * Displays all user notes with search and filtering.
 * Styled with ALFRED's "Signal in the Void" design system.
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
  TextInput,
  View,
} from "react-native";

import {
  BodyText,
  CaptionText,
  FluidButton,
  HUDSurface,
  TitleText,
  VoidContainer,
} from "@/components/foundation";
import { ListSkeleton } from "@/components/loading-skeleton";
import {
  type NoteRouterOutputs,
  useNoteDelete,
  useNoteList,
} from "@/hooks/use-trpc";
import { useVoidTheme } from "@/hooks/use-void-theme";
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
  const theme = useVoidTheme();
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
    <VoidContainer gradient="ambient" noise noiseOpacity={0.03}>
      <Stack.Screen
        options={{
          title: "Notes",
          headerStyle: { backgroundColor: theme.colors.void.deep },
          headerTintColor: theme.colors.biolum.bright,
          headerRight: () => (
            <Pressable
              style={styles.headerButton}
              onPress={() => router.push("/library/notes/new")}
              hitSlop={8}
            >
              {({ pressed }) => (
                <Ionicons
                  color={theme.colors.accent.cyan}
                  name="add"
                  size={24}
                  style={pressed ? styles.pressed : undefined}
                />
              )}
            </Pressable>
          ),
        }}
      />

      <View style={styles.content}>
        {/* Search and sort bar */}
        <View style={styles.searchBar}>
          <HUDSurface elevation={1} style={styles.searchInputContainer}>
            <Ionicons
              color={theme.colors.biolum.dim}
              name="search-outline"
              size={20}
            />
            <TextInput
              accessibilityLabel="Search notes"
              accessibilityRole="search"
              style={[
                styles.searchInput,
                { color: theme.colors.biolum.bright },
              ]}
              onChangeText={setSearchQuery}
              placeholder="Search notes..."
              placeholderTextColor={theme.colors.biolum.faint}
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() => setSearchQuery("")}
                hitSlop={8}
              >
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
          <View style={styles.sortRow}>
            <Ionicons
              color={theme.colors.biolum.faint}
              name="funnel-outline"
              size={16}
            />
            <CaptionText>Sort:</CaptionText>
            {sortOptions.map((option) => (
              <Pressable
                accessibilityLabel={`Sort by ${option.label}`}
                accessibilityRole="button"
                key={option.key}
                onPress={() => setSortBy(option.key)}
                style={[
                  styles.sortPill,
                  {
                    backgroundColor:
                      sortBy === option.key
                        ? theme.colors.glass.active
                        : theme.colors.glass.surface,
                    borderColor:
                      sortBy === option.key
                        ? theme.colors.accent.cyan
                        : theme.colors.glass.border,
                  },
                ]}
              >
                {({ pressed }) => (
                  <CaptionText
                    color={sortBy === option.key ? "bright" : "dim"}
                    style={pressed ? styles.pressed : undefined}
                  >
                    {option.label}
                  </CaptionText>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notes list */}
        {notesQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ListSkeleton count={5} />
          </View>
        ) : (sortedNotes && sortedNotes.length > 0 ? (
          <FlashList
            contentContainerStyle={styles.listContent}
            data={sortedNotes}
            keyExtractor={(item) => item.id}
            // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
            estimatedItemSize={100}
            ListFooterComponent={
              notesQuery.isLoading && offset > 0 ? (
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
                  notesQuery.refetch();
                }}
                refreshing={notesQuery.isRefetching}
                tintColor={theme.colors.accent.cyan}
              />
            }
            renderItem={renderNoteItem}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              color={theme.colors.biolum.faint}
              name="document-text-outline"
              size={48}
            />
            <BodyText color="dim" style={styles.emptyText}>
              {searchQuery
                ? "No notes match your search"
                : "No notes yet. Create your first note!"}
            </BodyText>
            {!searchQuery && (
              <FluidButton
                label="Create Note"
                onPress={() => router.push("library/notes/new")}
                variant="primary"
                size="medium"
                style={styles.createButton}
              />
            )}
          </View>
        ))}
      </View>
    </VoidContainer>
  );
}

interface NoteItemProps {
  item: NoteItem;
  onDelete: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}

function NoteItem({ item, onDelete }: NoteItemProps) {
  const theme = useVoidTheme();

  return (
    <Link asChild href={`library/notes/${item.id}`}>
      <Pressable
        accessibilityHint="Double tap to view or edit this note"
        accessibilityLabel={`Note: ${item.title || "Untitled Note"}`}
        accessibilityRole="button"
      >
        {({ pressed }) => (
          <HUDSurface
            elevation={1}
            active={pressed}
            style={[styles.noteCard, pressed && styles.pressed]}
          >
            <View style={styles.noteHeader}>
              <BodyText
                color="bright"
                style={styles.noteTitle}
                numberOfLines={1}
              >
                {item.title || "Untitled Note"}
              </BodyText>
              <Pressable
                accessibilityHint="Double tap to delete this note"
                accessibilityLabel="Delete note"
                accessibilityRole="button"
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                hitSlop={8}
              >
                {({ pressed: deletePressed }) => (
                  <Ionicons
                    color={theme.colors.semantic.error}
                    name="trash-outline"
                    size={18}
                    style={deletePressed ? styles.pressed : undefined}
                  />
                )}
              </Pressable>
            </View>
            {item.content ? (
              <BodyText
                color="dim"
                numberOfLines={2}
                style={styles.notePreview}
              >
                {item.content}
              </BodyText>
            ) : null}
            {item.tags && item.tags.length > 0 ? (
              <View style={styles.tagsContainer}>
                {item.tags.map((tag: string, idx: number) => (
                  <View
                    key={idx}
                    style={[
                      styles.tag,
                      { backgroundColor: theme.colors.glass.surface },
                    ]}
                  >
                    <CaptionText color="standard">{tag}</CaptionText>
                  </View>
                ))}
              </View>
            ) : null}
            {item.updated ? (
              <CaptionText mono style={styles.noteDate}>
                {new Date(item.updated).toLocaleDateString()}
              </CaptionText>
            ) : null}
          </HUDSurface>
        )}
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
  content: {
    flex: 1,
  },
  headerButton: {
    marginRight: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
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
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  sortPill: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  createButton: {
    marginTop: 16,
  },
  noteCard: {
    marginBottom: 12,
    padding: 16,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  noteTitle: {
    flex: 1,
    fontWeight: "600",
  },
  notePreview: {
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  noteDate: {
    marginTop: 8,
  },
});
