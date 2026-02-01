import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { useAuthClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export default function FocusScreen() {
  const authClient = useAuthClient();
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const utils = trpc.useUtils();

  const activeSet = trpc.focus.active.useQuery();
  const attention = trpc.attention.list.useQuery({
    status: "open",
    limit: 50,
  });
  const delta = trpc.delta.list.useQuery({ limit: 20 });

  const resolveAttention = trpc.attention.resolve.useMutation({
    onSuccess: async () => {
      await utils.attention.list.invalidate();
    },
  });

  const isRefreshing =
    activeSet.isRefetching || attention.isRefetching || delta.isRefetching;

  const refresh = async () => {
    await Promise.all([
      utils.focus.active.invalidate(),
      utils.attention.list.invalidate(),
      utils.delta.list.invalidate(),
    ]);
  };

  const headerTitle = useMemo(() => {
    if (activeSet.data?.title) {
      return activeSet.data.title;
    }
    return "Focus";
  }, [activeSet.data?.title]);

  if (!session?.user) {
    return <Redirect href="/(drawer)/" />;
  }

  return (
    <Container>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refresh();
            }}
            refreshing={isRefreshing}
          />
        }
      >
        <View className="px-4 py-6">
          <View className="mb-4">
            <Text className="font-bold text-2xl text-foreground">
              {headerTitle}
            </Text>
            {activeSet.data ? (
              <Text className="text-muted-foreground">
                WIP limit {activeSet.data.wipLimit}
              </Text>
            ) : (
              <Text className="text-muted-foreground">
                No active focus set.
              </Text>
            )}
          </View>

          <View className="mb-6 rounded-lg border border-border bg-card p-4">
            <Text className="mb-2 font-semibold text-foreground text-lg">
              Attention
            </Text>

            {attention.isLoading ? (
              <View className="py-8">
                <ActivityIndicator color="#3b82f6" size="large" />
              </View>
            ) : ((attention.data ?? []).length === 0 ? (
              <Text className="py-6 text-center text-muted-foreground">
                No open attention items.
              </Text>
            ) : (
              <View className="space-y-3">
                {attention.data?.map((item) => (
                  <View
                    className="rounded-md border border-border bg-background p-3"
                    key={item.id}
                  >
                    <Text className="font-semibold text-foreground text-sm">
                      {item.title ?? item.kind}
                    </Text>
                    {item.body ? (
                      <Text className="mt-1 text-muted-foreground text-xs">
                        {item.body}
                      </Text>
                    ) : null}
                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-muted-foreground text-xs">
                        {item.urgency}
                      </Text>
                      <View className="flex-row items-center space-x-2">
                        {item.workflowRunId ? (
                          <TouchableOpacity
                            className="flex-row items-center rounded-md bg-primary px-3 py-2"
                            onPress={() => {
                              router.push({
                                pathname: "/(drawer)/call",
                                params: {
                                  runId: item.workflowRunId ?? "",
                                  resource: `workflow_run:${item.workflowRunId ?? ""}`,
                                },
                              });
                            }}
                          >
                            <Ionicons
                              color="#fff"
                              name="call-outline"
                              size={16}
                            />
                            <Text className="ml-2 font-medium text-white">
                              Call
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          className="rounded-md bg-muted px-3 py-2"
                          disabled={resolveAttention.isPending}
                          onPress={() => {
                            resolveAttention.mutate({ id: item.id });
                          }}
                        >
                          <Text className="font-medium text-foreground">
                            Resolve
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View className="rounded-lg border border-border bg-card p-4">
            <Text className="mb-2 font-semibold text-foreground text-lg">
              Delta
            </Text>
            {delta.isLoading ? (
              <View className="py-6">
                <ActivityIndicator color="#3b82f6" size="small" />
              </View>
            ) : ((delta.data ?? []).length === 0 ? (
              <Text className="py-6 text-center text-muted-foreground">
                No delta yet.
              </Text>
            ) : (
              <View className="space-y-2">
                {delta.data?.slice(0, 10).map((brief) => (
                  <View
                    className="rounded-md border border-border bg-background p-3"
                    key={brief.id}
                  >
                    <Text className="text-muted-foreground text-xs">
                      {brief.scope}
                    </Text>
                    <Text className="mt-1 text-foreground text-sm">
                      {brief.summaryText}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
