/**
 * Server Settings Screen
 *
 * Configure ALFRED server connection.
 */

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  VoidContainer,
  HUDSurface,
  BodyText,
  CaptionText,
  TitleText,
} from "@/components/foundation";
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
    <VoidContainer gradient="ambient" noise={true} noiseOpacity={0.03}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TitleText size="large">Server</TitleText>
            <CaptionText color="dim">
              Set the base URL for your ALFRED server. For remote connectivity,
              Tailscale + HTTPS (`*.ts.net`) is recommended.
            </CaptionText>
          </View>

          {/* Current Configuration */}
          <HUDSurface elevation={1} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="server-outline"
                size={20}
                color="rgba(255,255,255,0.6)"
              />
              <BodyText style={styles.cardTitle}>
                Current Configuration
              </BodyText>
            </View>
            <View style={styles.configRow}>
              <CaptionText color="dim">URL:</CaptionText>
              <BodyText style={styles.configValue}>
                {serverUrl ?? "Not configured"}
              </BodyText>
            </View>
            <View style={styles.configRow}>
              <CaptionText color="dim">Source:</CaptionText>
              <BodyText style={styles.configValue}>{serverUrlSource}</BodyText>
            </View>
            <View style={styles.configRow}>
              <CaptionText color="dim">Type:</CaptionText>
              <BodyText style={styles.configValue}>
                {classificationLabel}
              </BodyText>
            </View>
          </HUDSurface>

          {/* Edit Configuration */}
          <HUDSurface elevation={1} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="create-outline"
                size={20}
                color="rgba(255,255,255,0.6)"
              />
              <BodyText style={styles.cardTitle}>Edit Configuration</BodyText>
            </View>

            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              onChangeText={setDraft}
              placeholder="https://alfred-home.example.ts.net"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={draft}
            />

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color="#FF3366"
                />
                <CaptionText style={styles.errorText}>{error}</CaptionText>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => void onSave()}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.button,
                  styles.saveButton,
                  pressed && styles.buttonPressed,
                  isSaving && styles.buttonDisabled,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <BodyText style={styles.saveButtonText}>Save</BodyText>
                )}
              </Pressable>

              <Pressable
                onPress={() => void onReset()}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.button,
                  styles.resetButton,
                  pressed && styles.buttonPressed,
                  isSaving && styles.buttonDisabled,
                ]}
              >
                <BodyText>Reset</BodyText>
              </Pressable>
            </View>
          </HUDSurface>

          {/* Connectivity Check */}
          <HUDSurface elevation={1} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="pulse-outline"
                size={20}
                color="rgba(255,255,255,0.6)"
              />
              <BodyText style={styles.cardTitle}>Connectivity Check</BodyText>
            </View>

            <CaptionText color="dim" style={styles.checkDescription}>
              Calls `GET /healthz` on the configured server URL to verify
              connectivity.
            </CaptionText>

            <Pressable
              onPress={() => void onCheck()}
              disabled={!canCheck || health.state === "checking"}
              style={({ pressed }) => [
                styles.checkButton,
                pressed && styles.checkButtonPressed,
                (!canCheck || health.state === "checking") &&
                  styles.checkButtonDisabled,
              ]}
            >
              {health.state === "checking" ? (
                <ActivityIndicator size="small" color="#00D9FF" />
              ) : (
                <View style={styles.checkButtonContent}>
                  <Ionicons name="play-outline" size={18} color="#00D9FF" />
                  <BodyText style={styles.checkButtonText}>Run Check</BodyText>
                </View>
              )}
            </Pressable>

            {health.state === "ok" && (
              <View style={[styles.healthResult, styles.healthOk]}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#00FF88"
                />
                <BodyText style={styles.healthOkText}>
                  OK ({health.latencyMs}ms)
                </BodyText>
              </View>
            )}

            {health.state === "fail" && (
              <View style={[styles.healthResult, styles.healthFail]}>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color="#FF3366"
                />
                <BodyText style={styles.healthFailText}>
                  Failed: {health.error}
                  {typeof health.latencyMs === "number"
                    ? ` (${health.latencyMs}ms)`
                    : ""}
                </BodyText>
              </View>
            )}
          </HUDSurface>
        </ScrollView>
      </SafeAreaView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  cardTitle: {
    fontWeight: "600",
  },
  configRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  configValue: {
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 14,
    marginBottom: 12,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    color: "#FF3366",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButton: {
    backgroundColor: "#00D9FF",
  },
  saveButtonText: {
    color: "#000",
    fontWeight: "600",
  },
  resetButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  checkDescription: {
    marginBottom: 16,
    lineHeight: 20,
  },
  checkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 217, 255, 0.3)",
    backgroundColor: "rgba(0, 217, 255, 0.1)",
  },
  checkButtonPressed: {
    backgroundColor: "rgba(0, 217, 255, 0.2)",
  },
  checkButtonDisabled: {
    opacity: 0.5,
  },
  checkButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkButtonText: {
    color: "#00D9FF",
    fontWeight: "600",
  },
  healthResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  healthOk: {
    backgroundColor: "rgba(0, 255, 136, 0.1)",
  },
  healthOkText: {
    color: "#00FF88",
  },
  healthFail: {
    backgroundColor: "rgba(255, 51, 102, 0.1)",
  },
  healthFailText: {
    color: "#FF3366",
  },
});
