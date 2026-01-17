import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugError(null);

    await authClient.signIn.email(
      {
        email: email.trim(),
        password,
      },
      {
        onError: (error) => {
          const message = error.error?.message || "Failed to sign in";
          const resp = (error as unknown as { response?: unknown }).response as
            | { headers?: { map?: Record<string, string[]> } }
            | undefined;
          const map = resp?.headers?.map;
          const dbgOrigin = map?.["x-alfred-origin"]?.[0];
          const dbgExpoOrigin = map?.["x-alfred-expo-origin"]?.[0];
          const dbgExpoNorm = map?.["x-alfred-expo-origin-normalized"]?.[0];

          const debugSuffix =
            __DEV__ && (dbgOrigin || dbgExpoOrigin || dbgExpoNorm)
              ? ` (origin=${dbgOrigin ?? "?"}, expo-origin=${
                  dbgExpoOrigin ?? "?"
                }, expo-origin-normalized=${dbgExpoNorm ?? "?"})`
              : "";

          setError(`${message}${debugSuffix}`);
          setDebugError(__DEV__ ? JSON.stringify(error, null, 2) : null);
          setIsLoading(false);
        },
        onSuccess: () => {
          setEmail("");
          setPassword("");
          queryClient.refetchQueries();
        },
        onFinished: () => {
          setIsLoading(false);
        },
      }
    );
  };

  const handlePasskeyLogin = async () => {
    if (!email) {
      setError("Please enter your email to use passkey sign-in");
      return;
    }

    setIsPasskeyLoading(true);
    setError(null);
    setDebugError(null);

    try {
      await authClient.signIn.passkey(
        { email },
        {
          onError: (error: { error?: { message?: string } }) => {
            setError(error.error?.message ?? "Passkey sign-in failed");
            setDebugError(__DEV__ ? JSON.stringify(error, null, 2) : null);
            setIsPasskeyLoading(false);
          },
          onSuccess: () => {
            setEmail("");
            setPassword("");
            queryClient.refetchQueries();
          },
          onFinished: () => {
            setIsPasskeyLoading(false);
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-in failed");
      setDebugError(__DEV__ ? String(err) : null);
      setIsPasskeyLoading(false);
    }
  };

  const isAnyLoading = isLoading || isPasskeyLoading;

  return (
    <View className="mt-6 rounded-lg border border-border bg-card p-4">
      <Text className="mb-4 font-semibold text-foreground text-lg">
        Sign In to Your Server
      </Text>

      {error && (
        <View className="mb-4 rounded-md bg-destructive/10 p-3">
          <Text className="text-destructive text-sm">{error}</Text>
          {__DEV__ && debugError && (
            <Text className="mt-2 font-mono text-destructive text-xs">
              {debugError}
            </Text>
          )}
        </View>
      )}

      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        className="mb-3 rounded-md border border-input bg-input p-4 text-foreground"
        editable={!isAnyLoading}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        value={email}
      />

      <TextInput
        autoComplete="password"
        className="mb-4 rounded-md border border-input bg-input p-4 text-foreground"
        editable={!isAnyLoading}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#9CA3AF"
        secureTextEntry
        value={password}
      />

      <TouchableOpacity
        className="mb-3 flex-row items-center justify-center rounded-md bg-primary p-4"
        disabled={isAnyLoading || !email.trim() || !password.trim()}
        onPress={handleLogin}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="font-medium text-primary-foreground">Sign In</Text>
        )}
      </TouchableOpacity>

      <View className="mb-3 flex-row items-center">
        <View className="h-px flex-1 bg-border" />
        <Text className="mx-4 text-muted-foreground text-sm">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <TouchableOpacity
        className="flex-row items-center justify-center rounded-md border border-border bg-card p-4"
        disabled={isAnyLoading || !email.trim()}
        onPress={handlePasskeyLogin}
      >
        {isPasskeyLoading ? (
          <ActivityIndicator color="#6366f1" size="small" />
        ) : (
          <Text className="font-medium text-foreground">
            Sign in with Face ID / Touch ID
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
