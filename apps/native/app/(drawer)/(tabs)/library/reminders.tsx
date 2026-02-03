/**
 * Reminders List Screen
 *
 * Displays all user reminders with filtering and search.
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

import type { RemindRouterOutputs } from "@/utils/trpc-types";

import {
  BodyText,
  CaptionText,
  FluidButton,
  HUDSurface,
  VoidContainer,
} from "@/components/foundation";
import { ListSkeleton } from "@/components/loading-skeleton";
import {
  useReminderDelete,
  useReminderFire,
  useReminderList,
} from "@/hooks/use-trpc";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { haptics } from "@/lib/haptics";
import {
  type FilterOption,
  fuzzySearch,
  type SortOption,
  sortFunctions,
} from "@/lib/search";

type ReminderItem = RemindRouterOutputs["list"][number];

const reminderSortOptions: SortOption<ReminderItem>[] = [
  {
    key: "due-asc",
    label: "Due Soon",
    sortFn: (a, b) => {
      const dateA = a.due
        ? new Date(a.due).getTime()
        : Number.POSITIVE_INFINITY;
      const dateB = b.due
        ? new Date(b.due).getTime()
        : Number.POSITIVE_INFINITY;
      return dateA - dateB;
    },
  },
  {
    key: "due-desc",
    label: "Due Later",
    sortFn: (a, b) => {
      const dateA = a.due
        ? new Date(a.due).getTime()
        : Number.POSITIVE_INFINITY;
      const dateB = b.due
        ? new Date(b.due).getTime()
        : Number.POSITIVE_INFINITY;
      return dateB - dateA;
    },
  },
  {
    key: "created-newest",
    label: "Newest",
    sortFn: sortFunctions.dateNewest,
  },
  {
    key: "title-asc",
    label: "Title A-Z",
    sortFn: sortFunctions.titleAsc,
  },
];

const reminderFilterOptions: FilterOption<ReminderItem>[] = [
  {
    key: "all",
    label: "All",
    filterFn: () => true,
  },
  {
    key: "pending",
    label: "Pending",
    filterFn: (item) => item.fired !== true,
  },
  {
    key: "completed",
    label: "Completed",
    filterFn: (item) => item.fired === true,
  },
];

export default function RemindersListScreen() {
  const router = useRouter();
  const theme = useVoidTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("due-asc");
  const [filterBy, setFilterBy] = useState<string>("all");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const remindersQuery = useReminderList({
    limit,
    offset,
  });

  useEffect(() => {
    if (remindersQuery.data) {
      setHasMore(remindersQuery.data.length === limit);
    }
  }, [remindersQuery.data, limit]);

  const handleLoadMore = useCallback(() => {
    if (!remindersQuery.isLoading && hasMore && !searchQuery.trim()) {
      setOffset((prev) => prev + limit);
    }
  }, [remindersQuery.isLoading, hasMore, searchQuery, limit]);

  const deleteMutation = useReminderDelete();
  const fireMutation = useReminderFire();

  useEffect(() => {
    if (deleteMutation.isSuccess || fireMutation.isSuccess) {
      remindersQuery.refetch();
    }
  }, [deleteMutation.isSuccess, fireMutation.isSuccess, remindersQuery]);

  const handleDelete = useCallback(
    (reminderId: string) => {
      haptics.medium();
      deleteMutation.mutate({ id: reminderId });
    },
    [deleteMutation]
  );

  const handleFire = useCallback(
    (reminderId: string) => {
      haptics.success();
      fireMutation.mutate({ id: reminderId });
    },
    [fireMutation]
  );

  // Apply fuzzy search
  const searchedReminders = searchQuery.trim()
    ? fuzzySearch(remindersQuery.data ?? [], searchQuery, (reminder) => [
        reminder.title || "",
        reminder.description || "",
      ])
    : (remindersQuery.data ?? []);

  // Apply filter
  const filteredReminders = useMemo(() => {
    const filterOption = reminderFilterOptions.find(
      (opt) => opt.key === filterBy
    );
    if (!filterOption) {
      return searchedReminders;
    }
    return searchedReminders.filter(filterOption.filterFn);
  }, [searchedReminders, filterBy]);

  // Apply sorting
  const sortedReminders = useMemo(() => {
    const sortOption = reminderSortOptions.find((opt) => opt.key === sortBy);
    if (!sortOption) {
      return filteredReminders;
    }
    return [...filteredReminders].sort(sortOption.sortFn);
  }, [filteredReminders, sortBy]);

  const renderReminderItem = useCallback(
    ({ item }: { item: ReminderItem }) => (
      <MemoizedReminderItem
        item={item}
        onDelete={handleDelete}
        onFire={handleFire}
        router={router}
      />
    ),
    [handleDelete, handleFire, router]
  );

  return (
    <VoidContainer gradient="ambient" noise noiseOpacity={0.03}>
      <Stack.Screen
        options={{
          title: "Reminders",
          headerStyle: { backgroundColor: theme.colors.void.deep },
          headerTintColor: theme.colors.biolum.bright,
          headerRight: () => (
            <Pressable
              style={styles.headerButton}
              onPress={() => router.push("library/reminders/new")}
              hitSlop={8}
            >
              {({ pressed }) => (
                <Ionicons
                  color={theme.colors.semantic.success}
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
        {/* Search, filter, and sort bar */}
        <View style={styles.controlsBar}>
          <HUDSurface elevation={1} style={styles.searchInputContainer}>
            <Ionicons
              color={theme.colors.biolum.dim}
              name="search-outline"
              size={20}
            />
            <TextInput
              accessibilityLabel="Search reminders"
              accessibilityRole="search"
              style={[
                styles.searchInput,
                { color: theme.colors.biolum.bright },
              ]}
              onChangeText={setSearchQuery}
              placeholder="Search reminders..."
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

          {/* Filter row */}
          <View style={styles.filterRow}>
            <Ionicons
              color={theme.colors.biolum.faint}
              name="filter-outline"
              size={16}
            />
            <CaptionText>Filter:</CaptionText>
            {reminderFilterOptions.map((option) => (
              <Pressable
                accessibilityLabel={`Filter ${option.label}`}
                accessibilityRole="button"
                key={option.key}
                onPress={() => setFilterBy(option.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor:
                      filterBy === option.key
                        ? theme.colors.glass.active
                        : theme.colors.glass.surface,
                    borderColor:
                      filterBy === option.key
                        ? theme.colors.semantic.success
                        : theme.colors.glass.border,
                  },
                ]}
              >
                {({ pressed }) => (
                  <CaptionText
                    color={filterBy === option.key ? "bright" : "dim"}
                    style={pressed ? styles.pressed : undefined}
                  >
                    {option.label}
                  </CaptionText>
                )}
              </Pressable>
            ))}
          </View>

          {/* Sort row */}
          <View style={styles.sortRow}>
            <Ionicons
              color={theme.colors.biolum.faint}
              name="funnel-outline"
              size={16}
            />
            <CaptionText>Sort:</CaptionText>
            {reminderSortOptions.map((option) => (
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
                        ? theme.colors.semantic.success
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

        {/* Reminders list */}
        {remindersQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ListSkeleton count={5} />
          </View>
        ) : sortedReminders && sortedReminders.length > 0 ? (
          <FlashList
            contentContainerStyle={styles.listContent}
            data={sortedReminders}
            keyExtractor={(item) => item.id}
            // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
            estimatedItemSize={120}
            ListFooterComponent={
              remindersQuery.isLoading && offset > 0 ? (
                <View style={styles.footer}>
                  <ActivityIndicator
                    color={theme.colors.semantic.success}
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
                  remindersQuery.refetch();
                }}
                refreshing={remindersQuery.isRefetching}
                tintColor={theme.colors.semantic.success}
              />
            }
            renderItem={renderReminderItem}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              color={theme.colors.biolum.faint}
              name="notifications-outline"
              size={48}
            />
            <BodyText color="dim" style={styles.emptyText}>
              {searchQuery
                ? "No reminders match your search"
                : "No reminders yet. Create your first reminder!"}
            </BodyText>
            {!searchQuery && (
              <FluidButton
                label="Create Reminder"
                onPress={() => router.push("library/reminders/new")}
                variant="primary"
                size="medium"
                style={styles.createButton}
              />
            )}
          </View>
        )}
      </View>
    </VoidContainer>
  );
}

interface ReminderItemProps {
  item: ReminderItem;
  onDelete: (id: string) => void;
  onFire: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}

function ReminderItem({ item, onDelete, onFire }: ReminderItemProps) {
  const theme = useVoidTheme();

  const formatDueDate = (due: string | Date) => {
    if (!due) {
      return "No due date";
    }
    const date = typeof due === "string" ? new Date(due) : due;
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return "Overdue";
    }
    if (days === 0) {
      return "Today";
    }
    if (days === 1) {
      return "Tomorrow";
    }
    if (days < 7) {
      return `In ${days} days`;
    }
    return date.toLocaleDateString();
  };

  const getDueDateColor = (due: string | Date) => {
    if (!due) return theme.colors.biolum.dim;
    const date = typeof due === "string" ? new Date(due) : due;
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return theme.colors.semantic.error;
    if (days === 0) return theme.colors.semantic.warning;
    return theme.colors.semantic.success;
  };

  return (
    <Link asChild href={`library/reminders/${item.id}`}>
      <Pressable>
        {({ pressed }) => (
          <HUDSurface
            elevation={1}
            active={pressed}
            glow={item.fired === true}
            style={[styles.reminderCard, pressed && styles.pressed]}
          >
            <View style={styles.reminderContent}>
              <View style={styles.reminderMain}>
                <BodyText
                  color="bright"
                  style={styles.reminderTitle}
                  numberOfLines={1}
                >
                  {item.title}
                </BodyText>
                {item.description ? (
                  <BodyText
                    color="dim"
                    numberOfLines={2}
                    style={styles.reminderDescription}
                  >
                    {item.description}
                  </BodyText>
                ) : null}
                <View style={styles.reminderMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons
                      color={getDueDateColor(item.due)}
                      name="time-outline"
                      size={14}
                    />
                    <CaptionText style={{ color: getDueDateColor(item.due) }}>
                      {formatDueDate(item.due)}
                    </CaptionText>
                  </View>
                  {item.fired ? (
                    <View style={styles.metaItem}>
                      <Ionicons
                        color={theme.colors.semantic.success}
                        name="checkmark-circle"
                        size={14}
                      />
                      <CaptionText color="standard">Completed</CaptionText>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.reminderActions}>
                {!item.fired && (
                  <Pressable
                    accessibilityLabel="Mark as complete"
                    accessibilityRole="button"
                    onPress={(e) => {
                      e.stopPropagation();
                      onFire(item.id);
                    }}
                    hitSlop={8}
                  >
                    {({ pressed: completePressed }) => (
                      <Ionicons
                        color={theme.colors.semantic.success}
                        name="checkmark-circle-outline"
                        size={24}
                        style={completePressed ? styles.pressed : undefined}
                      />
                    )}
                  </Pressable>
                )}
                <Pressable
                  accessibilityLabel="Delete reminder"
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
                      size={20}
                      style={deletePressed ? styles.pressed : undefined}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </HUDSurface>
        )}
      </Pressable>
    </Link>
  );
}

const MemoizedReminderItem = memo(
  ReminderItem,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.onDelete === next.onDelete &&
    prev.onFire === next.onFire &&
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
  controlsBar: {
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
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPill: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  reminderCard: {
    marginBottom: 12,
    padding: 16,
  },
  reminderContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  reminderMain: {
    flex: 1,
  },
  reminderTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  reminderDescription: {
    marginBottom: 8,
  },
  reminderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reminderActions: {
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
