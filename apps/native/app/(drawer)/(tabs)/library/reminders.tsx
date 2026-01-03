/**
 * Reminders List Screen
 *
 * Displays all user reminders with filtering and search.
 */

import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Link, Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { ListSkeleton } from "@/components/loading-skeleton";
import {
  useReminderDelete,
  useReminderFire,
  useReminderList,
} from "@/hooks/use-trpc";
import { haptics } from "@/lib/haptics";
import {
  type FilterOption,
  filterFunctions,
  fuzzySearch,
  type SortOption,
  sortFunctions,
} from "@/lib/search";

type ReminderItem = ReturnType<
  typeof useReminderList
>["data"] extends (infer T)[]
  ? T
  : never;

const reminderSortOptions: SortOption<any>[] = [
  {
    key: "due-asc",
    label: "Due Soon",
    sortFn: (a: any, b: any) => {
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
    sortFn: (a: any, b: any) => {
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

const reminderFilterOptions: FilterOption<any>[] = [
  {
    key: "all",
    label: "All",
    filterFn: () => true,
  },
  {
    key: "pending",
    label: "Pending",
    filterFn: filterFunctions.isPending,
  },
  {
    key: "completed",
    label: "Completed",
    filterFn: filterFunctions.isCompleted,
  },
];

export default function RemindersListScreen() {
  const router = useRouter();
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

  const formatDueDate = (due: string | Date) => {
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

  return (
    <Container>
      <Stack.Screen
        options={{
          title: "Reminders",
          headerRight: () => (
            <TouchableOpacity
              className="mr-4"
              onPress={() => router.push("library/reminders/new")}
            >
              <Ionicons color="#00FF88" name="add" size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <View className="flex-1">
        {/* Search, filter, and sort bar */}
        <View className="border-border border-b bg-background px-4 py-3">
          <View className="mb-2 flex-row items-center rounded-lg border border-border bg-surface px-3 py-2">
            <Ionicons color="#5A6B7D" name="search-outline" size={20} />
            <TextInput
              accessibilityLabel="Search reminders"
              accessibilityRole="search"
              className="ml-2 flex-1 text-foreground"
              onChangeText={setSearchQuery}
              placeholder="Search reminders..."
              placeholderTextColor="#5A6B7D"
              value={searchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() => setSearchQuery("")}
              >
                <Ionicons color="#5A6B7D" name="close-circle" size={20} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons color="#5A6B7D" name="filter-outline" size={16} />
            <Text className="text-muted-foreground text-sm">Filter:</Text>
            {reminderFilterOptions.map((option) => (
              <TouchableOpacity
                accessibilityLabel={`Filter ${option.label}`}
                accessibilityRole="button"
                className={`rounded-full px-3 py-1 ${
                  filterBy === option.key
                    ? "bg-primary"
                    : "border border-border bg-surface"
                }`}
                key={option.key}
                onPress={() => setFilterBy(option.key)}
              >
                <Text
                  className={`text-xs ${
                    filterBy === option.key
                      ? "font-semibold text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="mt-2 flex-row items-center gap-2">
            <Ionicons color="#5A6B7D" name="funnel-outline" size={16} />
            <Text className="text-muted-foreground text-sm">Sort:</Text>
            {reminderSortOptions.map((option) => (
              <TouchableOpacity
                accessibilityLabel={`Sort by ${option.label}`}
                accessibilityRole="button"
                className={`rounded-full px-3 py-1 ${
                  sortBy === option.key
                    ? "bg-primary"
                    : "border border-border bg-surface"
                }`}
                key={option.key}
                onPress={() => setSortBy(option.key)}
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
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reminders list */}
        {remindersQuery.isLoading ? (
          <View className="flex-1 px-4 py-4">
            <ListSkeleton count={5} />
          </View>
        ) : sortedReminders && sortedReminders.length > 0 ? (
          <FlashList
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            data={sortedReminders}
            estimatedItemSize={100}
            keyExtractor={(item) => item.id}
            ListFooterComponent={
              remindersQuery.isLoading && offset > 0 ? (
                <View className="py-4">
                  <ActivityIndicator color="#00FF88" size="small" />
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
              />
            }
            renderItem={({ item }) => (
              <Link asChild href={`library/reminders/${item.id}`}>
                <TouchableOpacity className="mb-3 rounded-lg border border-border bg-card p-4">
                  <View className="mb-2 flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="mb-1 font-semibold text-foreground text-lg">
                        {item.title}
                      </Text>
                      {item.description ? (
                        <Text
                          className="mb-2 text-muted-foreground text-sm"
                          numberOfLines={2}
                        >
                          {item.description}
                        </Text>
                      ) : null}
                      <View className="flex-row items-center gap-4">
                        <View className="flex-row items-center gap-1">
                          <Ionicons
                            color="#00FF88"
                            name="time-outline"
                            size={14}
                          />
                          <Text className="text-muted-foreground text-xs">
                            {formatDueDate(item.due)}
                          </Text>
                        </View>
                        {item.fired ? (
                          <View className="flex-row items-center gap-1">
                            <Ionicons
                              color="#00FF88"
                              name="checkmark-circle"
                              size={14}
                            />
                            <Text className="text-muted-foreground text-xs">
                              Completed
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View className="ml-2 flex-row gap-2">
                      {!item.fired && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleFire(item.id);
                          }}
                        >
                          <Ionicons
                            color="#00FF88"
                            name="checkmark-circle-outline"
                            size={20}
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      >
                        <Ionicons
                          color="#FF3366"
                          name="trash-outline"
                          size={18}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </Link>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons color="#5A6B7D" name="notifications-outline" size={48} />
            <Text className="mt-4 text-center text-lg text-muted-foreground">
              {searchQuery
                ? "No reminders match your search"
                : "No reminders yet. Create your first reminder!"}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                className="mt-4 rounded-lg bg-primary px-6 py-3"
                onPress={() => router.push("library/reminders/new")}
              >
                <Text className="font-semibold text-primary-foreground">
                  Create Reminder
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Container>
  );
}
