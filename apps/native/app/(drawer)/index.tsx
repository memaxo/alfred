import type { inferRouterOutputs } from "@trpc/server";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { TRPCAppRouter } from "@/utils/trpc";

import { BiolumOrb } from "@/components/foundation/BiolumOrb";
import {
  BiolumText,
  DisplayText,
  BodyText,
  CaptionText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { SignIn } from "@/components/sign-in";
import { useServerUrl } from "@/lib/api";
import { useAuthClient } from "@/lib/auth-client";
import { checkHealthz } from "@/lib/health";
import { isLocalServer } from "@/lib/server-url";
import { trpc } from "@/utils/trpc";

export default function Home() {
  const authClient = useAuthClient();
  const { serverUrl, serverClass, setServerUrl } = useServerUrl();
  const router = useRouter();
  const [healthz, setHealthz] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "ok"; latencyMs: number }
    | { state: "fail"; error: string }
  >({ state: "idle" });
  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type HealthCheckOutput = RouterOutputs["healthCheck"];
  type PrivateDataOutput = RouterOutputs["privateData"];

  const healthCheckQuery = trpc.healthCheck.useQuery() as {
    data: HealthCheckOutput | undefined;
    isLoading: boolean;
    error: Error | null;
  };
  const privateDataQuery = trpc.privateData.useQuery() as {
    data: PrivateDataOutput | undefined;
    isLoading: boolean;
  };

  const {
    data: healthCheck,
    isLoading: isHealthLoading,
    error: healthCheckError,
  } = healthCheckQuery;
  const { data: privateData, isLoading: isPrivateLoading } = privateDataQuery;
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!serverUrl) {
      setHealthz({ state: "idle" });
      return;
    }
    let cancelled = false;
    setHealthz({ state: "checking" });
    void checkHealthz(serverUrl, { timeoutMs: 4000 }).then((res) => {
      if (cancelled) {
        return;
      }
      if (res.ok) {
        setHealthz({ state: "ok", latencyMs: res.latencyMs });
        return;
      }
      setHealthz({ state: "fail", error: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, [serverUrl]);

  const isConnected = healthz.state === "ok" || !!healthCheck;
  const isTailnet =
    serverClass.kind === "tailnet-hostname" ||
    serverClass.kind === "tailnet-ipv4" ||
    serverClass.kind === "tailnet-ipv6";
  const isLocal = isLocalServer(serverUrl);
  const canCall = !!session?.user || isLocal;

  const getStatusColor = () => {
    if (healthz.state === "ok") {
      return "#00FF88";
    }
    if (healthz.state === "checking" || isHealthLoading) {
      return "#FFB800";
    }
    return "#FF4444";
  };

  const getStatusText = () => {
    if (healthz.state === "checking") {
      return "Connecting...";
    }
    if (healthz.state === "ok") {
      return `Connected (${healthz.latencyMs}ms)`;
    }
    if (healthz.state === "fail") {
      return "Connection failed";
    }
    if (isHealthLoading) {
      return "Checking...";
    }
    if (healthCheckError) {
      return "Error";
    }
    if (healthCheck) {
      return "Connected";
    }
    return "Disconnected";
  };

  return (
    <VoidContainer gradient="ambient" noise={true} noiseOpacity={0.03}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section with Orb */}
          <View style={styles.heroSection}>
            <BiolumOrb size={180} pulsing={true} active={isConnected} />
            <View style={styles.titleContainer}>
              <DisplayText size="large">ALFRED</DisplayText>
              <BodyText color="dim" style={styles.subtitle}>
                Signal in the Void
              </BodyText>
            </View>
          </View>

          {/* Server Status HUD */}
          <HUDSurface elevation={2} glow={true} style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIconContainer}>
                <Ionicons
                  name={isConnected ? "wifi" : "wifi-outline"}
                  size={20}
                  color={getStatusColor()}
                />
              </View>
              <View style={styles.statusTextContainer}>
                <BodyText color={isConnected ? "bright" : "standard"}>
                  {getStatusText()}
                </BodyText>
                {serverUrl && (
                  <CaptionText mono style={styles.serverUrl}>
                    {serverUrl}
                  </CaptionText>
                )}
              </View>
            </View>

            {isTailnet && (
              <View style={styles.tailnetBadge}>
                <CaptionText color="bright">
                  Connected via Tailscale
                </CaptionText>
              </View>
            )}

            {!serverUrl && (
              <FluidButton
                label="Use Local Server"
                onPress={() => void setServerUrl("http://127.0.0.1:3155")}
                variant="secondary"
                size="small"
                style={styles.localServerButton}
              />
            )}
          </HUDSurface>

          {/* Quick Actions */}
          {canCall && (
            <HUDSurface elevation={1} style={styles.actionsCard}>
              <View style={styles.actionsHeader}>
                <Ionicons
                  name="server"
                  size={18}
                  color="rgba(255,255,255,0.6)"
                />
                <CaptionText>Quick Actions</CaptionText>
              </View>

              <FluidButton
                label="Start Voice Call"
                icon={<Ionicons name="mic" size={18} color="#0A0A0F" />}
                onPress={() => router.push("/(drawer)/call")}
                variant="primary"
                size="large"
                style={styles.callButton}
              />
            </HUDSurface>
          )}

          {/* Private Data Section */}
          {session?.user ? (
            <HUDSurface elevation={1} style={styles.dataCard}>
              <View style={styles.dataHeader}>
                <BodyText color="bright">Session Active</BodyText>
                <CaptionText mono>{session.user.email}</CaptionText>
              </View>
              {!isPrivateLoading && privateData && (
                <View style={styles.dataContent}>
                  <BodyText color="dim" size="small">
                    {privateData.message}
                  </BodyText>
                </View>
              )}
            </HUDSurface>
          ) : (
            <SignIn />
          )}
        </ScrollView>
      </SafeAreaView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 24,
  },
  titleContainer: {
    alignItems: "center",
    gap: 8,
  },
  subtitle: {
    letterSpacing: 2,
  },
  statusCard: {
    marginBottom: 16,
    padding: 20,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusTextContainer: {
    flex: 1,
    gap: 4,
  },
  serverUrl: {
    opacity: 0.6,
  },
  tailnetBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0, 217, 255, 0.1)",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  localServerButton: {
    marginTop: 16,
  },
  actionsCard: {
    marginBottom: 16,
    padding: 20,
  },
  actionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  callButton: {
    width: "100%",
  },
  dataCard: {
    marginBottom: 16,
    padding: 20,
  },
  dataHeader: {
    gap: 4,
    marginBottom: 12,
  },
  dataContent: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
});
