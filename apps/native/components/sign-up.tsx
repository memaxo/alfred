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

export function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    setError(null);

    await authClient.signUp.email(
      {
        name: name.trim(),
        email: email.trim(),
        password,
      },
      {
        onError: (error) => {
          setError(error.error?.message || "Failed to create account");
          setIsLoading(false);
        },
        onSuccess: () => {
          setName("");
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

  const isFormValid = name.trim() && email.trim() && password.length >= 8;

  return (
    <View className="mt-6 rounded-lg border border-border bg-card p-4">
      <Text className="mb-4 font-semibold text-foreground text-lg">
        Create Account
      </Text>
      <Text className="mb-4 text-muted-foreground text-xs">
        Create your account on your ALFRED server
      </Text>

      {error && (
        <View className="mb-4 rounded-md bg-destructive/10 p-3">
          <Text className="text-destructive text-sm">{error}</Text>
        </View>
      )}

      <TextInput
        autoComplete="name"
        className="mb-3 rounded-md border border-input bg-input p-4 text-foreground"
        editable={!isLoading}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor="#9CA3AF"
        value={name}
      />

      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        className="mb-3 rounded-md border border-input bg-input p-4 text-foreground"
        editable={!isLoading}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        value={email}
      />

      <TextInput
        autoComplete="password-new"
        className="mb-4 rounded-md border border-input bg-input p-4 text-foreground"
        editable={!isLoading}
        onChangeText={setPassword}
        placeholder="Password (min. 8 characters)"
        placeholderTextColor="#9CA3AF"
        secureTextEntry
        value={password}
      />

      <TouchableOpacity
        className="flex-row items-center justify-center rounded-md bg-primary p-4"
        disabled={isLoading || !isFormValid}
        onPress={handleSignUp}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="font-medium text-primary-foreground">
            Create Account
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
