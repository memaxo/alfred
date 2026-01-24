import type { inferRouterOutputs } from "@trpc/server";

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import type { TRPCAppRouter } from "@/utils/trpc";

import { Container } from "@/components/container";
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

  const apiStatusIndicator =
    healthz.state === "ok" ? "bg-green-500" : "bg-red-500";
  const apiStatusText = (() => {
    if (healthz.state === "checking") {
      return "Checking /healthz...";
    }
    if (healthz.state === "ok") {
      return `Connected (${healthz.latencyMs}ms)`;
    }
    if (healthz.state === "fail") {
      return `Error: ${healthz.error}`;
    }
    if (isHealthLoading) {
      return "Checking...";
    }
    if (healthCheckError) {
      return `Error: ${healthCheckError.message || "Connection failed"}`;
    }
    if (healthCheck) {
      return "Connected to API";
    }
    return "API Disconnected";
  })();

  const displayUrl = serverUrl ?? "Not configured";
  const isTailnet =
    serverClass.kind === "tailnet-hostname" ||
    serverClass.kind === "tailnet-ipv4" ||
    serverClass.kind === "tailnet-ipv6";
  const isLocal = isLocalServer(serverUrl);
  const canCall = !!session?.user || isLocal;

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4">
          <Text className="mb-4 font-bold text-4xl text-foreground">
            ALFRED
          </Text>
          <Text className="mb-6 text-muted-foreground text-sm">
            Your self-hosted AI assistant
          </Text>

          <View className="mb-6 rounded-lg border border-border p-4">
            <Text className="mb-3 font-medium text-foreground">
              Server Status
            </Text>
            <View className="flex-row items-center gap-2">
              <View className={`h-3 w-3 rounded-full ${apiStatusIndicator}`} />
              <Text className="text-muted-foreground">{apiStatusText}</Text>
            </View>
            <View className="mt-3">
              <Text className="mb-1 text-muted-foreground text-xs">
                Server URL:
              </Text>
              <Text className="font-mono text-muted-foreground text-xs">
                {displayUrl}
              </Text>
            </View>
            {isTailnet && (
              <View className="mt-2 rounded-md bg-blue-500/10 p-2">
                <Text className="text-blue-600 text-xs dark:text-blue-400">
                  ✓ Connected via Tailscale
                </Text>
              </View>
            )}

            {!serverUrl && (
              <TouchableOpacity
                accessibilityLabel="Use local test server"
                accessibilityRole="button"
                className="mt-4 items-center justify-center rounded-md bg-secondary px-4 py-3"
                onPress={() => void setServerUrl("http://127.0.0.1:3155")}
                testID="Use local test server"
              >
                <Text className="font-medium text-secondary-foreground">
                  Use local test server
                </Text>
              </TouchableOpacity>
            )}

            {canCall && (
              <TouchableOpacity
                accessibilityLabel="Call Alfred"
                accessibilityRole="button"
                className="mt-3 items-center justify-center rounded-md bg-primary px-4 py-3"
                onPress={() => router.push("/(drawer)/call")}
                testID="Call Alfred"
              >
                <Text className="font-medium text-primary-foreground">
                  Call Alfred
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {session?.user ? (
            <View className="mb-6 rounded-lg border border-border p-4">
              <Text className="mb-3 font-medium text-foreground">
                Private Data
              </Text>
              {!isPrivateLoading && privateData && (
                <View>
                  <Text className="text-muted-foreground">
                    {privateData.message}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <SignIn />
          )}
        </View>
      </ScrollView>
    </Container>
  );
}
