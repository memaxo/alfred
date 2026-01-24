import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function ExploreWindow({ window }: WindowComponentProps) {
  const [query, setQuery] = useState("");

  const searchQuery = trpc.knowledge.entitiesList.useQuery(
    { search: query, limit: 20 },
    { enabled: query.length >= 2 }
  );

  const results = (searchQuery.data as any)?.entities ?? [];

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">
          Knowledge Explorer
        </Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Search facts, entities, and relationships
        </Text>
      </View>

      {/* Search Input */}
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <TextInput
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
          placeholder="Search knowledge..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Results */}
      {searchQuery.isLoading ? (
        <View className="py-8">
          <ActivityIndicator color="#00D9FF" />
        </View>
      ) : searchQuery.error ? (
        <View className="rounded-lg border border-destructive/30 bg-card p-4">
          <Text className="text-destructive text-sm">
            {searchQuery.error.message}
          </Text>
        </View>
      ) : query.length < 2 ? (
        <View className="rounded-lg border border-border bg-card p-4">
          <Text className="text-center text-muted-foreground">
            Enter at least 2 characters to search
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View className="rounded-lg border border-border bg-card p-4">
          <Text className="text-center text-muted-foreground">
            No results found for "{query}"
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {results.map((item: any, idx: number) => (
            <View
              className="rounded-lg border border-border bg-card p-4"
              key={item.id ?? idx}
            >
              <Text className="font-medium text-foreground text-sm">
                {item.name ?? "Unknown"}
              </Text>
              {item.type && (
                <Text className="mt-1 text-muted-foreground text-xs">
                  Type: {item.type}
                </Text>
              )}
              {item.description && (
                <Text className="mt-1 text-muted-foreground text-xs">
                  {item.description}
                </Text>
              )}
              {item.confidence !== undefined && item.confidence !== null && (
                <Text className="mt-1 text-muted-foreground text-xs">
                  Confidence: {(item.confidence * 100).toFixed(1)}%
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
