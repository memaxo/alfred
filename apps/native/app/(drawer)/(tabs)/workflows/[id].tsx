/**
 * Workflow Detail Screen
 *
 * View workflow details and resume suspended workflows with biometric auth.
 */

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
import { trpc } from "@/utils/trpc";

export default function WorkflowDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Note: Adjust query based on actual workflow router structure
  const workflowQuery = (trpc.workflow as Record<string, any>).get?.useQuery(
    { id: id ?? "" },
    { enabled: !!id }
  ) ?? { data: null, isLoading: false };

  const resumeMutation = (
    trpc.workflow as Record<string, any>
  ).resume?.useMutation({
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
        resumeMutation.mutate({ id });
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

  const workflow = workflowQuery.data;
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

        {workflow?.createdAt && (
          <View className="mb-4">
            <Text className="mb-2 font-semibold text-foreground">Created</Text>
            <Text className="text-foreground">
              {new Date(workflow.createdAt).toLocaleString()}
            </Text>
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
