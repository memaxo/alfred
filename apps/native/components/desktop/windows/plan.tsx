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

export function PlanWindow(_props: WindowComponentProps) {
  const [input, setInput] = useState("");
  const [intent, setIntent] = useState<unknown>(null);
  const [research, setResearch] = useState<unknown>(null);
  const [generated, setGenerated] = useState<unknown>(null);

  const parseIntent = trpc.plan.parseIntent.useMutation({
    onSuccess: (data) => {
      setIntent(data);
      setResearch(null);
      setGenerated(null);
    },
  });
  const fullResearch = trpc.plan.fullResearch.useMutation({
    onSuccess: (data) => {
      setResearch(data);
      setGenerated(null);
    },
  });
  const generate = trpc.plan.generate.useMutation({
    onSuccess: (data) => {
      setGenerated(data);
    },
  });

  const intentText = useMemo(() => {
    try {
      return JSON.stringify(intent ?? null, null, 2);
    } catch {
      return "null";
    }
  }, [intent]);

  const researchText = useMemo(() => {
    try {
      return JSON.stringify(research ?? null, null, 2);
    } catch {
      return "null";
    }
  }, [research]);

  const generatedText = useMemo(() => {
    try {
      return JSON.stringify(generated ?? null, null, 2);
    } catch {
      return "null";
    }
  }, [generated]);

  const canParse = input.trim().length > 0 && !parseIntent.isPending;
  const canResearch = intent !== null && !fullResearch.isPending;
  const canGenerate =
    intent !== null && research !== null && !generate.isPending;

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Plan</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Intent parsing and plan generation.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Input</Text>
        <TextInput
          className="mt-3 min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
          multiline
          onChangeText={setInput}
          placeholder="What do you want to do?"
          placeholderTextColor="#6b7280"
          textAlignVertical="top"
          value={input}
        />

        <View className="mt-3 flex-row flex-wrap gap-2">
          <TouchableOpacity
            className={[
              "rounded-md px-4 py-2",
              canParse ? "bg-primary" : "bg-muted",
            ].join(" ")}
            disabled={!canParse}
            onPress={() =>
              parseIntent.mutate({
                input: input.trim(),
                source: "chat",
              })
            }
          >
            {parseIntent.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="font-medium text-primary-foreground text-sm">
                Parse intent
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className={[
              "rounded-md px-4 py-2",
              canResearch ? "bg-secondary" : "bg-muted",
            ].join(" ")}
            disabled={!canResearch}
            onPress={() =>
              fullResearch.mutate({
                intent: intent as unknown,
                options: {},
              })
            }
          >
            {fullResearch.isPending ? (
              <ActivityIndicator color="#3b82f6" size="small" />
            ) : (
              <Text className="font-medium text-secondary-foreground text-sm">
                Research
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className={[
              "rounded-md px-4 py-2",
              canGenerate ? "bg-secondary" : "bg-muted",
            ].join(" ")}
            disabled={!canGenerate}
            onPress={() =>
              generate.mutate({
                intent: intent as unknown,
                research: research as unknown,
                options: { preferParallel: true, maxPhases: 6 },
              })
            }
          >
            {generate.isPending ? (
              <ActivityIndicator color="#3b82f6" size="small" />
            ) : (
              <Text className="font-medium text-secondary-foreground text-sm">
                Generate
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="rounded-md bg-secondary px-4 py-2"
            onPress={() => {
              setIntent(null);
              setResearch(null);
              setGenerated(null);
              setInput("");
            }}
          >
            <Text className="font-medium text-secondary-foreground text-sm">
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        {parseIntent.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {parseIntent.error.message}
          </Text>
        ) : null}
        {fullResearch.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {fullResearch.error.message}
          </Text>
        ) : null}
        {generate.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {generate.error.message}
          </Text>
        ) : null}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Intent</Text>
        <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
          {intentText.slice(0, 4000)}
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Research</Text>
        <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
          {researchText.slice(0, 4000)}
        </Text>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Generated</Text>
        <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
          {generatedText.slice(0, 4000)}
        </Text>
      </View>
    </ScrollView>
  );
}
