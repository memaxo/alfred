/**
 * Workflow Detail Screen
 *
 * View workflow details and resume suspended workflows with biometric auth.
 */

import { workflowCompilationSchema } from "@alfred/type/compilation";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import {
  useWorkflowCompilationGet,
  useWorkflowGet,
  useWorkflowResume,
} from "@/hooks/use-trpc";

export default function WorkflowDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const workflowQuery = useWorkflowGet({ runId: id ?? "" });
  const workflow = workflowQuery.data;
  const isCompletedOrFailed =
    workflow?.status === "completed" || workflow?.status === "failed";
  const compilationQuery = useWorkflowCompilationGet(
    { runId: id ?? "" },
    { enabled: Boolean(id) && isCompletedOrFailed }
  );
  const compilationParsed = workflowCompilationSchema.safeParse(
    compilationQuery.data
  );
  const compilation = compilationParsed.success ? compilationParsed.data : null;

  const resumeMutation = useWorkflowResume({
    onSuccess: () => {
      router.back();
    },
  });

  const handleResume = useCallback(async () => {
    if (!id) {
      return;
    }

    setIsAuthenticating(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert(
          "Biometric Auth Unavailable",
          "Your device does not support biometric authentication."
        );
        setIsAuthenticating(false);
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert(
          "Biometric Not Set Up",
          "Please set up biometric authentication in your device settings."
        );
        setIsAuthenticating(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to resume workflow",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        resumeMutation.mutate({ runId: id });
      } else {
        Alert.alert("Authentication Failed", "Please try again.");
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Authentication failed"
      );
    } finally {
      setIsAuthenticating(false);
    }
  }, [id, resumeMutation]);

  if (workflowQuery.isLoading) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00D9FF" size="large" />
        </View>
      </Container>
    );
  }

  if (!workflowQuery.data && id) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-lg text-muted-foreground">
            Workflow not found
          </Text>
        </View>
      </Container>
    );
  }

  const isSuspended = workflow?.status === "suspended";

  return (
    <Container>
      <Stack.Screen
        options={{
          title: "Workflow Details",
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="mb-4">
          <Text className="mb-2 font-semibold text-foreground">Status</Text>
          <View className="flex-row items-center gap-2">
            <View
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor:
                  workflow?.status === "completed"
                    ? "#00FF88"
                    : workflow?.status === "suspended"
                      ? "#FFB800"
                      : workflow?.status === "running"
                        ? "#00D9FF"
                        : "#5A6B7D",
              }}
            />
            <Text className="text-foreground">
              {workflow?.status ?? "Unknown"}
            </Text>
          </View>
        </View>

        {workflow?.id && (
          <View className="mb-4">
            <Text className="mb-2 font-semibold text-foreground">ID</Text>
            <Text className="font-mono text-foreground text-sm">
              {workflow.id}
            </Text>
          </View>
        )}

        {workflow?.created && (
          <View className="mb-4">
            <Text className="mb-2 font-semibold text-foreground">Created</Text>
            <Text className="text-foreground">
              {new Date(workflow.created).toLocaleString()}
            </Text>
          </View>
        )}

        {isCompletedOrFailed && (
          <View className="mb-4">
            <Text className="mb-2 font-semibold text-foreground">
              Work Compilation
            </Text>
            {compilationQuery.isLoading ? (
              <View className="items-center justify-center py-3">
                <ActivityIndicator color="#00D9FF" size="small" />
              </View>
            ) : compilationQuery.isError ? (
              <Text className="text-red-500">
                {compilationQuery.error.message}
              </Text>
            ) : compilationQuery.data ? (
              compilation ? (
                <View className="gap-3 rounded-xl border border-border bg-card p-4">
                  <View>
                    <Text className="mb-1 text-muted-foreground text-xs">
                      Summary
                    </Text>
                    <Text className="text-foreground">
                      {compilation.summaryText ?? "—"}
                    </Text>
                  </View>

                  <View>
                    <Text className="mb-1 text-muted-foreground text-xs">
                      Files
                    </Text>
                    <Text className="text-foreground">
                      Created: {compilation.fileChanges.created.length}
                    </Text>
                    <Text className="text-foreground">
                      Modified: {compilation.fileChanges.modified.length}
                    </Text>
                    <Text className="text-foreground">
                      Deleted: {compilation.fileChanges.deleted.length}
                    </Text>
                  </View>

                  <View>
                    <Text className="mb-1 text-muted-foreground text-xs">
                      Agents
                    </Text>
                    {compilation.agents.length === 0 ? (
                      <Text className="text-muted-foreground">
                        No agent outcomes recorded.
                      </Text>
                    ) : (
                      <View className="gap-2">
                        {compilation.agents.slice(0, 20).map((agent) => (
                          <View
                            className="rounded-lg border border-border bg-background p-3"
                            key={agent.agentId}
                          >
                            <Text className="font-mono text-foreground text-xs">
                              {agent.agentId}
                            </Text>
                            <Text className="text-muted-foreground text-xs">
                              {agent.status}
                            </Text>
                            {agent.result?.summary ? (
                              <Text className="mt-1 text-foreground">
                                {agent.result.summary}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                        {compilation.agents.length > 20 ? (
                          <Text className="text-muted-foreground text-xs">
                            Showing first 20 agents.
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <Text className="text-muted-foreground">
                  Compilation is not in a supported format yet.
                </Text>
              )
            ) : (
              <Text className="text-muted-foreground">
                No compilation is available for this run yet.
              </Text>
            )}
          </View>
        )}

        {isSuspended && (
          <TouchableOpacity
            className="mt-4 rounded-lg bg-primary px-6 py-4"
            disabled={isAuthenticating || resumeMutation.isPending}
            onPress={handleResume}
          >
            {isAuthenticating || resumeMutation.isPending ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text className="font-semibold text-primary-foreground">
                  Authenticating...
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-center gap-2">
                <Ionicons color="#FFFFFF" name="finger-print" size={20} />
                <Text className="font-semibold text-primary-foreground">
                  Resume with Biometric Auth
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </Container>
  );
}
