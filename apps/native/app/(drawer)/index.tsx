import type { inferRouterOutputs } from "@trpc/server";
import { ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { authClient } from "@/lib/auth-client";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export default function Home() {
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
  const apiStatusIndicator = healthCheck ? "bg-green-500" : "bg-red-500";
  const apiStatusText = (() => {
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

  const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL || "Not configured";
  const isTailscale =
    serverUrl.includes("tailscale") || serverUrl.includes("100.");

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
                {serverUrl}
              </Text>
            </View>
            {isTailscale && (
              <View className="mt-2 rounded-md bg-blue-500/10 p-2">
                <Text className="text-blue-600 text-xs dark:text-blue-400">
                  ✓ Connected via Tailscale
                </Text>
              </View>
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
