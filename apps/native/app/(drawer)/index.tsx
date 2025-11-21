import type { inferRouterOutputs } from "@trpc/server";
import { ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
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
  };
  const privateDataQuery = trpc.privateData.useQuery() as {
    data: PrivateDataOutput | undefined;
    isLoading: boolean;
  };

  const { data: healthCheck, isLoading: isHealthLoading } = healthCheckQuery;
  const { data: privateData, isLoading: isPrivateLoading } = privateDataQuery;
  const { data: session } = authClient.useSession();
  const apiStatusIndicator = healthCheck ? "bg-green-500" : "bg-red-500";
  const apiStatusText = (() => {
    if (isHealthLoading) {
      return "Checking...";
    }
    if (healthCheck) {
      return "Connected to API";
    }
    return "API Disconnected";
  })();

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4">
          <Text className="mb-4 font-bold font-mono text-3xl text-foreground">
            BETTER T STACK
          </Text>

          <View className="mb-6 rounded-lg border border-border p-4">
            <Text className="mb-3 font-medium text-foreground">API Status</Text>
            <View className="flex-row items-center gap-2">
              <View className={`h-3 w-3 rounded-full ${apiStatusIndicator}`} />
              <Text className="text-muted-foreground">{apiStatusText}</Text>
            </View>
          </View>
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
          {!session?.user && (
            <>
              <SignIn />
              <SignUp />
            </>
          )}
        </View>
      </ScrollView>
    </Container>
  );
}
