import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { useServerUrl } from "@/lib/api";
import { checkHealthz } from "@/lib/health";
import { normalizeServerUrl } from "@/lib/server-url";
import { queryClient } from "@/utils/trpc";

function describeClassification(kind: string): string {
  switch (kind) {
    case "tailnet-hostname": {
      return "Tailnet hostname (.ts.net)";
    }
    case "tailnet-ipv4": {
      return "Tailnet IPv4 (100.64.0.0/10)";
    }
    case "tailnet-ipv6": {
      return "Tailnet IPv6 (fd7a:115c:a1e0::/48)";
    }
    case "non-tailnet": {
      return "Non-tailnet URL";
    }
    default: {
      return "Unknown";
    }
  }
}

export default function ServerSettings() {
  const {
    serverUrl,
    serverUrlSource,
    serverClass,
    setServerUrl,
    resetServerUrl,
  } = useServerUrl();

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [health, setHealth] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "ok"; latencyMs: number }
    | { state: "fail"; error: string; latencyMs?: number }
  >({ state: "idle" });

  useEffect(() => {
    setDraft(serverUrl ?? "");
  }, [serverUrl]);

  const classificationLabel = useMemo(
    () => describeClassification(serverClass.kind),
    [serverClass.kind]
  );

  const canCheck = typeof serverUrl === "string" && serverUrl.length > 0;

  const onSave = async () => {
    setError(null);
    const parsed = normalizeServerUrl(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setIsSaving(true);
    try {
      const result = await setServerUrl(parsed.url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      queryClient.clear();
      Alert.alert("Saved", "Server URL updated.");
    } finally {
      setIsSaving(false);
    }
  };

  const onReset = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await resetServerUrl();
      queryClient.clear();
      Alert.alert("Reset", "Server URL reset to the default (env).");
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
    <Container>
      <ScrollView className="flex-1 p-6">
        <Text className="mb-2 font-bold text-3xl text-foreground">Server</Text>
        <Text className="mb-6 text-muted-foreground">
          Set the base URL for your ALFRED server. For remote connectivity,
          Tailscale + HTTPS (`*.ts.net`) is recommended.
        </Text>

        <View className="mb-6 rounded-lg border border-border bg-card p-4">
          <Text className="font-medium text-foreground">Current</Text>
          <Text className="mt-2 font-mono text-muted-foreground text-xs">
            {serverUrl ?? "Not configured"}
          </Text>
          <Text className="mt-2 text-muted-foreground text-sm">
            Source: {serverUrlSource}
          </Text>
          <Text className="mt-1 text-muted-foreground text-sm">
            Classification: {classificationLabel}
          </Text>
        </View>

        <View className="mb-6 rounded-lg border border-border bg-card p-4">
          <Text className="mb-2 font-medium text-foreground">Edit</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-md border border-border bg-background px-4 py-3 text-foreground"
            editable={!isSaving}
            onChangeText={setDraft}
            placeholder="https://alfred-home.example.ts.net"
            placeholderTextColor="#6b7280"
            value={draft}
          />
          {error ? (
            <Text className="mt-2 text-destructive text-sm">{error}</Text>
          ) : null}

          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center justify-center rounded-md bg-primary px-4 py-3"
              disabled={isSaving}
              onPress={() => void onSave()}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="font-medium text-primary-foreground">
                  Save
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 items-center justify-center rounded-md border border-border bg-background px-4 py-3"
              disabled={isSaving}
              onPress={() => void onReset()}
            >
              <Text className="font-medium text-foreground">Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="rounded-lg border border-border bg-card p-4">
          <Text className="mb-2 font-medium text-foreground">
            Connectivity check
          </Text>
          <Text className="mb-3 text-muted-foreground text-sm">
            Calls `GET /healthz` on the configured server URL.
          </Text>

          <TouchableOpacity
            className={`items-center justify-center rounded-md px-4 py-3 ${
              canCheck ? "bg-secondary" : "bg-muted"
            }`}
            disabled={!canCheck || health.state === "checking"}
            onPress={() => void onCheck()}
          >
            {health.state === "checking" ? (
              <ActivityIndicator color="#3b82f6" size="small" />
            ) : (
              <Text className="font-medium text-secondary-foreground">
                Run check
              </Text>
            )}
          </TouchableOpacity>

          {health.state === "ok" ? (
            <Text className="mt-3 text-emerald-500 text-sm">
              OK ({health.latencyMs}ms)
            </Text>
          ) : null}
          {health.state === "fail" ? (
            <Text className="mt-3 text-destructive text-sm">
              Failed: {health.error}
              {typeof health.latencyMs === "number"
                ? ` (${health.latencyMs}ms)`
                : ""}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Container>
  );
}
