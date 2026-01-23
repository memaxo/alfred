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

export function DroidWindow(_props: WindowComponentProps) {
  const [authz, setAuthz] = useState("");
  const [prompt, setPrompt] = useState("");
  const [auto, setAuto] = useState<"read" | "low" | "medium" | "high">("read");
  const [result, setResult] = useState<string>("");

  const run = trpc.droid.run.useMutation({
    onSuccess: (data) => {
      const out = data as unknown as {
        exitCode?: number | string;
        stdout?: string;
        stderr?: string;
      };
      const lines = [
        `exitCode: ${String(out.exitCode ?? "")}`,
        "",
        "stdout:",
        String(out.stdout ?? ""),
        "",
        "stderr:",
        String(out.stderr ?? ""),
      ];
      setResult(lines.join("\n"));
    },
  });

  const canRun =
    authz.trim().length > 0 && prompt.trim().length > 0 && !run.isPending;

  const errorText = useMemo(() => {
    if (!run.error) {
      return null;
    }
    return run.error.message ?? "droid_run_failed";
  }, [run.error]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Droid</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Execute a sandboxed tool run (requires a tool auth token).
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Auth token</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setAuthz}
          placeholder="authz token…"
          placeholderTextColor="#6b7280"
          value={authz}
        />

        <Text className="mt-4 font-medium text-foreground text-sm">Prompt</Text>
        <TextInput
          className="mt-3 min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
          multiline
          onChangeText={setPrompt}
          placeholder="What should Droid do?"
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
            onPress={() => {
              setResult("");
              run.mutate({
                prompt: prompt.trim(),
                authz: authz.trim(),
                auto,
                out: "text",
                cw: ".",
              });
            }}
          >
            {run.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-primary-foreground text-xs">Run</Text>
            )}
          </TouchableOpacity>
        </View>

        {errorText ? (
          <Text className="mt-2 text-destructive text-xs">{errorText}</Text>
        ) : null}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Output</Text>
        <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
          {result.length > 0 ? result.slice(0, 7000) : "No output yet."}
        </Text>
      </View>
    </ScrollView>
  );
}
