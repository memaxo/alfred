import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function KnowledgeWindow(_props: WindowComponentProps) {
  const openWindow = useDesktopStore((s) => s.openWindow);
  const [search, setSearch] = useState("");
  const [extractText, setExtractText] = useState("");
  const [lastViz, setLastViz] = useState<{
    nodes: Array<{ id: string; label: string; entityType?: string }>;
    edges: Array<{ id: string; fromId: string; toId: string; kind: string }>;
    meta?: unknown;
  } | null>(null);

  const statsQuery = trpc.knowledge.stats.useQuery({ resource: "user" });
  const entitiesQuery = trpc.knowledge.entitiesList.useQuery({
    resource: "user",
    search: search.trim().length > 0 ? search.trim() : undefined,
    limit: 50,
  });

  const visualize = trpc.knowledge.visualize.useMutation({
    onSuccess: (data) => {
      setLastViz({
        nodes: (data as any).nodes ?? [],
        edges: (data as any).edges ?? [],
        meta: (data as any).meta,
      });
    },
  });

  const entities = useMemo(
    () => (entitiesQuery.data as any)?.entities ?? [],
    [entitiesQuery.data]
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Knowledge</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Browse the knowledge graph and extract entities from text.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Stats</Text>
        {statsQuery.isLoading ? (
          <View className="py-4">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : statsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {statsQuery.error.message}
          </Text>
        ) : (
          <View className="mt-2 gap-1">
            <Text className="text-muted-foreground text-xs">
              facts: {String((statsQuery.data as any)?.facts ?? 0)}
            </Text>
            <Text className="text-muted-foreground text-xs">
              relations: {String((statsQuery.data as any)?.relations ?? 0)}
            </Text>
            <Text className="text-muted-foreground text-xs">
              insights: {String((statsQuery.data as any)?.insights ?? 0)}
            </Text>
            <Text className="text-muted-foreground text-xs">
              patterns: {String((statsQuery.data as any)?.patterns ?? 0)}
            </Text>
          </View>
        )}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Extract</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Paste text, then extract entities and relations into the graph.
        </Text>
        <TextInput
          className="mt-3 min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
          multiline
          onChangeText={setExtractText}
          placeholder="Paste text…"
          placeholderTextColor="#6b7280"
          textAlignVertical="top"
          value={extractText}
        />
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            className={[
              "flex-1 items-center justify-center rounded-md px-3 py-2",
              extractText.trim().length > 0 && !visualize.isPending
                ? "bg-primary"
                : "bg-muted",
            ].join(" ")}
            disabled={extractText.trim().length === 0 || visualize.isPending}
            onPress={() =>
              visualize.mutate({
                text: extractText.trim(),
                resource: "user",
                limit: 20,
              })
            }
          >
            {visualize.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="font-medium text-primary-foreground text-sm">
                Extract
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="items-center justify-center rounded-md bg-secondary px-3 py-2"
            onPress={() => {
              setExtractText("");
              setLastViz(null);
            }}
          >
            <Text className="font-medium text-secondary-foreground text-sm">
              Clear
            </Text>
          </TouchableOpacity>
        </View>
        {lastViz ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Extracted: {lastViz.nodes.length} nodes, {lastViz.edges.length}{" "}
            edges
          </Text>
        ) : null}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Entities</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={entitiesQuery.isFetching}
            onPress={() => void entitiesQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setSearch}
          placeholder="Search…"
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
            {entities.map((e: any) => (
              <TouchableOpacity
                className="rounded-md border border-border bg-background p-3"
                key={String(e.id)}
                onPress={() =>
                  openWindow("concept", {
                    label: e.label ?? "Concept",
                    entityId: e.id,
                  })
                }
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(e.label ?? e.id)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(e.kind ?? "entity")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
