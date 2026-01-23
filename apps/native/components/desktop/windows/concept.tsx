import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function ConceptWindow({ window }: WindowComponentProps) {
  const [search, setSearch] = useState("");
  const entityId = asString((window.data as Record<string, unknown>).entityId);

  const entitiesQuery = trpc.knowledge.entitiesList.useQuery({
    resource: "user",
    search: search.trim().length > 0 ? search.trim() : undefined,
    limit: 50,
  });

  const entities = useMemo(
    () => (entitiesQuery.data as any)?.entities ?? [],
    [entitiesQuery.data]
  );

  const selected = useMemo(() => {
    if (!entityId) {
      return null;
    }
    return entities.find((e: any) => String(e.id) === entityId) ?? null;
  }, [entities, entityId]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Concept</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Quick entity lookup over the knowledge graph.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Search</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setSearch}
          placeholder="Search entities…"
          placeholderTextColor="#6b7280"
          value={search}
        />

        {entitiesQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : entities.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No results.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {entities.slice(0, 20).map((e: any) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={String(e.id)}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(e.label ?? e.id)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  kind: {String(e.kind ?? "unknown")}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Selected</Text>
        {entityId ? (
          selected ? (
            <View className="mt-2">
              <Text className="text-foreground text-sm">
                {String(selected.label ?? selected.id)}
              </Text>
              <Text className="mt-1 text-muted-foreground text-xs">
                id: {String(selected.id)}
              </Text>
              <Text className="mt-1 text-muted-foreground text-xs">
                kind: {String(selected.kind ?? "unknown")}
              </Text>
            </View>
          ) : (
            <Text className="mt-2 text-muted-foreground text-xs">
              Entity id provided, but not found in current results.
            </Text>
          )
        ) : (
          <Text className="mt-2 text-muted-foreground text-xs">
            Open from Knowledge to pin an entity here.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
