/**
 * Protected Route Component
 *
 * Redirects unauthenticated users to the home screen for sign-in.
 */

import { Redirect, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuthClient } from "@/lib/auth-client";

import { Container } from "./container";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authClient = useAuthClient();
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!(isPending || session?.user)) {
      // Redirect to home screen for sign-in
      router.replace("/(drawer)/");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00D9FF" size="large" />
          <Text className="mt-4 text-muted-foreground">Loading...</Text>
        </View>
      </Container>
    );
  }

  if (!session?.user) {
    return <Redirect href="/(drawer)/" />;
  }

  return <>{children}</>;
}
