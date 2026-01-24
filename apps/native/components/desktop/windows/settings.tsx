import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useServerUrl } from "@/lib/api";
import { checkHealthz } from "@/lib/health";
import { normalizeServerUrl } from "@/lib/server-url";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4 rounded-lg border border-border bg-card p-4">
      <Text className="font-semibold text-foreground text-sm">{title}</Text>
      {description ? (
        <Text className="mt-1 text-muted-foreground text-xs">
          {description}
        </Text>
      ) : null}
      <View className="mt-3">{children}</View>
    </View>
  );
}

export function SettingsWindow(_props: WindowComponentProps) {
  const {
    serverUrl,
    serverUrlSource,
    setServerUrl,
    resetServerUrl,
    serverClass,
  } = useServerUrl();

  const [draftUrl, setDraftUrl] = useState(serverUrl ?? "");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [health, setHealth] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "ok"; latencyMs: number }
    | { state: "fail"; error: string; latencyMs?: number }
  >({ state: "idle" });

  const notifyQuery = trpc.notification.getPreferences.useQuery();
  const notifyMutation = trpc.notification.setPreferences.useMutation({
    onSuccess: async () => {
      await notifyQuery.refetch();
    },
  });

  const preferenceQuery = trpc.preference.list.useQuery({
    limit: 200,
    offset: 0,
  });
  const preferenceMutation = trpc.preference.set.useMutation({
    onSuccess: async () => {
      await preferenceQuery.refetch();
    },
  });

  const sttChunkSize = useMemo(() => {
    const row = (preferenceQuery.data ?? []).find(
      (p: { key: string; value?: unknown }) => p.key === "voice.stt.chunk_size"
    );
    const value = row?.value;
    if (
      value === "fast" ||
      value === "low" ||
      value === "medium" ||
      value === "accurate"
    ) {
      return value;
    }
    return "fast";
  }, [preferenceQuery.data]);

  const onSaveServer = async () => {
    setUrlError(null);
    const parsed = normalizeServerUrl(draftUrl);
    if (!parsed.ok) {
      setUrlError(parsed.error);
      return;
    }
    setIsSaving(true);
    try {
      await setServerUrl(parsed.url);
    } finally {
      setIsSaving(false);
    }
  };

  const onResetServer = async () => {
    setUrlError(null);
    setIsSaving(true);
    try {
      await resetServerUrl();
      setDraftUrl("");
    } finally {
      setIsSaving(false);
    }
  };

  const onCheck = async () => {
    if (!serverUrl) {
      return;
    }
    setHealth({ state: "checking" });
    const result = await checkHealthz(serverUrl, { timeoutMs: 5000 });
    if (result.ok) {
      setHealth({ state: "ok", latencyMs: result.latencyMs });
      return;
    }
    setHealth({
      state: "fail",
      error: result.error,
      latencyMs: result.latencyMs,
    });
  };

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <Section
        description="Configure server connectivity and preferences."
        title="Settings"
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-muted-foreground text-xs">
            Server source: {serverUrlSource}
          </Text>
          <Text className="text-muted-foreground text-xs">
            Class: {serverClass.kind}
          </Text>
        </View>
      </Section>

      <Section
        description="Update the base URL for your ALFRED server."
        title="Server"
      >
        <Text className="font-mono text-muted-foreground text-xs">
          {serverUrl ?? "Not configured"}
        </Text>
        <View className="mt-3">
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            editable={!isSaving}
            onChangeText={setDraftUrl}
            placeholder="https://alfred-home.example.ts.net"
            placeholderTextColor="#6b7280"
            value={draftUrl}
          />
          {urlError ? (
            <Text className="mt-2 text-destructive text-xs">{urlError}</Text>
          ) : null}

          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity
              className="flex-1 items-center justify-center rounded-md bg-primary px-3 py-2"
              disabled={isSaving}
              onPress={() => void onSaveServer()}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="font-medium text-primary-foreground text-sm">
                  Save
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 items-center justify-center rounded-md border border-border bg-background px-3 py-2"
              disabled={isSaving}
              onPress={() => void onResetServer()}
            >
              <Text className="font-medium text-foreground text-sm">Reset</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="mt-3 items-center justify-center rounded-md bg-secondary px-3 py-2"
            disabled={!serverUrl || health.state === "checking"}
            onPress={() => void onCheck()}
          >
            {health.state === "checking" ? (
              <ActivityIndicator color="#3b82f6" size="small" />
            ) : (
              <Text className="font-medium text-secondary-foreground text-sm">
                Check /healthz
              </Text>
            )}
          </TouchableOpacity>

          {health.state === "ok" ? (
            <Text className="mt-2 text-emerald-500 text-xs">
              OK ({health.latencyMs}ms)
            </Text>
          ) : null}
          {health.state === "fail" ? (
            <Text className="mt-2 text-destructive text-xs">
              Failed: {health.error}
              {typeof health.latencyMs === "number"
                ? ` (${health.latencyMs}ms)`
                : ""}
            </Text>
          ) : null}
        </View>
      </Section>

      <Section
        description="Controls the voice transcription tradeoff."
        title="Voice"
      >
        <Text className="text-muted-foreground text-xs">
          STT chunk size: {sttChunkSize}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["fast", "low", "medium", "accurate"] as const).map((v) => (
            <TouchableOpacity
              className={[
                "rounded-md border px-3 py-2",
                v === sttChunkSize
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              ].join(" ")}
              disabled={preferenceMutation.isPending}
              key={v}
              onPress={() =>
                preferenceMutation.mutate({
                  key: "voice.stt.chunk_size",
                  value: v,
                  source: "user",
                  confidence: 1.0,
                })
              }
            >
              <Text className="text-foreground text-xs">{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section
        description="Controls which notifications are delivered."
        title="Notifications"
      >
        {notifyQuery.isLoading ? (
          <ActivityIndicator color="#00D9FF" />
        ) : (
          <View className="gap-3">
            {(
              [
                ["agentCompletions", "Agent completions"],
                ["workflowEvents", "Workflow events"],
                ["systemAlerts", "System alerts"],
              ] as const
            ).map(([key, label]) => {
              const value = notifyQuery.data?.[key] ?? true;
              return (
                <View
                  className="flex-row items-center justify-between"
                  key={key}
                >
                  <Text className="text-foreground text-sm">{label}</Text>
                  <Switch
                    onValueChange={(next) =>
                      notifyMutation.mutate({ [key]: next } as Record<
                        string,
                        boolean
                      >)
                    }
                    value={value}
                  />
                </View>
              );
            })}
          </View>
        )}
      </Section>
    </ScrollView>
  );
}
