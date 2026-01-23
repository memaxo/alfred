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

function tailText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return value.slice(value.length - max);
}

export function TerminalWindow({ window: _window }: WindowComponentProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");

  const create = trpc.terminal.createSession.useMutation({
    onSuccess: (data) => {
      setSessionId((data as any).sessionId);
      setOut("");
    },
  });
  const write = trpc.terminal.write.useMutation();
  const kill = trpc.terminal.kill.useMutation({
    onSuccess: () => setSessionId(null),
  });

  trpc.terminal.events.useSubscription(
    { sessionId: sessionId ?? "missing" },
    {
      enabled: sessionId !== null,
      onData: (chunk) => {
        const text = String(chunk ?? "");
        if (text.length === 0) {
          return;
        }
        setOut((prev) => tailText(prev + text, 12_000));
      },
      onError: (err) => {
        setOut((prev) =>
          tailText(`${prev}\n[error] ${String(err.message)}\n`, 12_000)
        );
      },
    }
  );

  const canSend = sessionId !== null && input.length > 0 && !write.isPending;
  const lines = useMemo(() => out.split("\n").slice(-200), [out]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Terminal</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Server-side PTY session (Bun PTY or node-pty).
        </Text>

        <View className="mt-3 flex-row flex-wrap gap-2">
          <TouchableOpacity
            className="rounded-md bg-primary px-3 py-2"
            disabled={create.isPending}
            onPress={() => create.mutate({ cols: 90, rows: 28 })}
          >
            {create.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-primary-foreground text-xs">
                New session
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => setOut("")}
          >
            <Text className="text-secondary-foreground text-xs">Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-md bg-destructive/10 px-3 py-2"
            disabled={sessionId === null || kill.isPending}
            onPress={() => {
              if (!sessionId) {
                return;
              }
              kill.mutate({ sessionId });
            }}
          >
            <Text className="text-destructive text-xs">Kill</Text>
          </TouchableOpacity>
        </View>

        {create.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {create.error.message}
          </Text>
        ) : null}
        {sessionId ? (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            sessionId={sessionId}
          </Text>
        ) : (
          <Text className="mt-2 text-muted-foreground text-xs">
            No session yet.
          </Text>
        )}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Input</Text>
        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            onChangeText={setInput}
            onSubmitEditing={() => {
              if (!sessionId) {
                return;
              }
              const text = input;
              setInput("");
              write.mutate({ sessionId, data: `${text}\n` });
            }}
            placeholder="Type a command…"
            placeholderTextColor="#6b7280"
            value={input}
          />
          <TouchableOpacity
            className={[
              "rounded-md px-4 py-2",
              canSend ? "bg-secondary" : "bg-muted",
            ].join(" ")}
            disabled={!canSend}
            onPress={() => {
              if (!sessionId) {
                return;
              }
              const text = input;
              setInput("");
              write.mutate({ sessionId, data: `${text}\n` });
            }}
          >
            <Text className="text-secondary-foreground text-xs">Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Output</Text>
        <View className="mt-3 gap-1">
          {lines.map((l, idx) => (
            <Text
              className="font-mono text-[10px] text-muted-foreground"
              key={`${idx}`}
            >
              {l}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
