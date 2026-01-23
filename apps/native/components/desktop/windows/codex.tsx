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

export function CodexWindow({ window: _window }: WindowComponentProps) {
  const [prompt, setPrompt] = useState("");
  const [auto, setAuto] = useState<"read" | "low" | "medium" | "high">("read");
  const [result, setResult] = useState<string>("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const sessionsQuery = trpc.codex.listSessions.useQuery({
    limit: 20,
    offset: 0,
  });
  const runsQuery = trpc.codex.listRuns.useQuery({ limit: 20, offset: 0 });
  const eventsQuery = trpc.codex.events.useQuery(
    {
      runId: selectedRunId ?? "00000000-0000-0000-0000-000000000000",
      order: "desc",
      limit: 200,
    },
    { enabled: selectedRunId !== null, retry: false }
  );

  const run = trpc.codex.run.useMutation({
    onSuccess: (data) => {
      setResult(String((data as any).result ?? ""));
      const runId = (data as any).runId;
      if (typeof runId === "string" && runId.length > 0) {
        setSelectedRunId(runId);
      }
    },
  });

  const sessions = useMemo(
    () => (sessionsQuery.data as any)?.sessions ?? [],
    [sessionsQuery.data]
  );
  const runs = useMemo(
    () => (runsQuery.data as any)?.runs ?? [],
    [runsQuery.data]
  );
  const events = useMemo(
    () => (eventsQuery.data as any)?.events ?? (eventsQuery.data as any) ?? [],
    [eventsQuery.data]
  );

  const canRun = prompt.trim().length > 0 && !run.isPending;

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Codex</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Run Codex on the server (read-only default).
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Prompt</Text>
        <TextInput
          className="mt-3 min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
          multiline
          onChangeText={setPrompt}
          placeholder="Ask Codex to do something…"
          placeholderTextColor="#6b7280"
          textAlignVertical="top"
          value={prompt}
        />
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["read", "low", "medium", "high"] as const).map((a) => (
            <TouchableOpacity
              className={[
                "rounded-md border px-3 py-2",
                a === auto
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              ].join(" ")}
              key={a}
              onPress={() => setAuto(a)}
            >
              <Text className="text-foreground text-xs">{a}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            className={[
              "rounded-md px-4 py-2",
              canRun ? "bg-primary" : "bg-muted",
            ].join(" ")}
            disabled={!canRun}
            onPress={() =>
              run.mutate({
                prompt: prompt.trim(),
                auto,
                out: "text",
                cw: ".",
              } as any)
            }
          >
            {run.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-primary-foreground text-xs">Run</Text>
            )}
          </TouchableOpacity>
        </View>
        {run.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {run.error.message}
          </Text>
        ) : null}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Result</Text>
        <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
          {result.length > 0 ? result.slice(0, 5000) : "No output yet."}
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Runs</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={runsQuery.isFetching}
            onPress={() => void runsQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {runsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : runsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {runsQuery.error.message}
          </Text>
        ) : runs.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No runs yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {runs.slice(0, 10).map((r: any) => {
              const id = String(r.id ?? r.runId ?? "");
              const status = String(r.status ?? "");
              return (
                <TouchableOpacity
                  className={[
                    "rounded-md border p-3",
                    selectedRunId === id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background",
                  ].join(" ")}
                  key={id}
                  onPress={() => setSelectedRunId(id)}
                >
                  <Text className="font-medium text-foreground text-sm">
                    {status || "run"}
                  </Text>
                  <Text className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Events</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={selectedRunId === null || eventsQuery.isFetching}
            onPress={() => void eventsQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>

        {selectedRunId === null ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Select a run above.
          </Text>
        ) : eventsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : eventsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {eventsQuery.error.message}
          </Text>
        ) : Array.isArray(events) && events.length > 0 ? (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(events.slice(0, 50), null, 2).slice(0, 5000)}
          </Text>
        ) : (
          <Text className="mt-2 text-muted-foreground text-xs">No events.</Text>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Sessions</Text>
        {sessionsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : sessionsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {sessionsQuery.error.message}
          </Text>
        ) : sessions.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No sessions.
          </Text>
        ) : (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(sessions.slice(0, 10), null, 2).slice(0, 2500)}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
