import { useMemo, useState } from "react";
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

export function RagWindow(_props: WindowComponentProps) {
  const [q, setQ] = useState("");
  const [topK, setTopK] = useState("5");

  const embedQuery = trpc.embed.getConfig.useQuery();
  const chunksQuery = trpc.graph.getRagChunks.useQuery(
    {
      text: q.trim().length > 0 ? q.trim() : "hello",
      topK: Math.max(1, Math.min(20, Number(topK) || 5)),
      resource: "user",
    },
    { enabled: q.trim().length > 0, retry: false }
  );

  const chunks = useMemo(
    () => (chunksQuery.data as any)?.chunks ?? [],
    [chunksQuery.data]
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">RAG</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Retrieve relevant chunks from the knowledge store.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">
          Embed config
        </Text>
        {embedQuery.isLoading ? (
          <View className="py-4">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : embedQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {embedQuery.error.message}
          </Text>
        ) : (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(embedQuery.data, null, 2)}
          </Text>
        )}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Query</Text>
        <TextInput
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setQ}
          placeholder="Ask a question…"
          placeholderTextColor="#6b7280"
          value={q}
        />
        <TextInput
          className="mt-2 w-20 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          keyboardType="number-pad"
          onChangeText={setTopK}
          placeholder="topK"
          placeholderTextColor="#6b7280"
          value={topK}
        />
        <TouchableOpacity
          className="mt-3 items-center justify-center rounded-md bg-secondary px-3 py-2"
          disabled={chunksQuery.isFetching || q.trim().length === 0}
          onPress={() => void chunksQuery.refetch()}
        >
          {chunksQuery.isFetching ? (
            <ActivityIndicator color="#3b82f6" size="small" />
          ) : (
            <Text className="font-medium text-secondary-foreground text-sm">
              Retrieve
            </Text>
          )}
        </TouchableOpacity>
        {chunksQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {chunksQuery.error.message}
          </Text>
        ) : null}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Chunks</Text>
        {chunksQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : chunks.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            {q.trim().length === 0 ? "Enter a query above." : "No results."}
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {chunks.map((c: any) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={String(c.id)}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(c.source ?? "chunk")}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  score: {String(c.score ?? "")}
                </Text>
                <Text
                  className="mt-2 text-muted-foreground text-xs"
                  numberOfLines={6}
                >
                  {String(c.content ?? "")}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
