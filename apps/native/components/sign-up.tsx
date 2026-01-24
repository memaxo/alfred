import { signUpSchema } from "@alfred/type/forms";
import { useForm } from "@tanstack/react-form";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuthClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

function errorText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "message" in value) {
    const msg = (value as { message?: unknown }).message;
    if (typeof msg === "string") {
      return msg;
    }
  }
  return String(value);
}

export function SignUp() {
  const authClient = useAuthClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
    validators: {
      onSubmit: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      setError(null);

      await authClient.signUp.email(
        {
          name: value.name.trim(),
          email: value.email.trim(),
          password: value.password,
        },
        {
          onError: (error) => {
            setError(error.error?.message || "Failed to create account");
            setIsLoading(false);
          },
          onSuccess: () => {
            form.reset();
            queryClient.refetchQueries();
          },
          onFinished: () => {
            setIsLoading(false);
          },
        }
      );
    },
  });

  const handleSignUp = useCallback(() => {
    void form.handleSubmit();
  }, [form]);

  const canSubmit = form.state.canSubmit;
  const { name, email, password } = form.state.values;

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

      <form.Field name="name">
        {(field) => (
          <View>
            <TextInput
              autoComplete="name"
              className="mb-1 rounded-md border border-input bg-input p-4 text-foreground"
              editable={!isLoading}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              placeholder="Name"
              placeholderTextColor="#9CA3AF"
              value={field.state.value}
            />
            {field.state.meta.errors.length > 0 ? (
              <Text className="mb-3 text-destructive text-xs">
                {errorText(field.state.meta.errors[0])}
              </Text>
            ) : (
              <View className="mb-3" />
            )}
          </View>
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <View>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              className="mb-1 rounded-md border border-input bg-input p-4 text-foreground"
              editable={!isLoading}
              keyboardType="email-address"
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              value={field.state.value}
            />
            {field.state.meta.errors.length > 0 ? (
              <Text className="mb-3 text-destructive text-xs">
                {errorText(field.state.meta.errors[0])}
              </Text>
            ) : (
              <View className="mb-3" />
            )}
          </View>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <View>
            <TextInput
              autoComplete="password-new"
              className="mb-1 rounded-md border border-input bg-input p-4 text-foreground"
              editable={!isLoading}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              placeholder="Password (min. 8 characters)"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={field.state.value}
            />
            {field.state.meta.errors.length > 0 ? (
              <Text className="mb-4 text-destructive text-xs">
                {errorText(field.state.meta.errors[0])}
              </Text>
            ) : (
              <View className="mb-4" />
            )}
          </View>
        )}
      </form.Field>

      <TouchableOpacity
        className="flex-row items-center justify-center rounded-md bg-primary p-4"
        disabled={
          isLoading ||
          !canSubmit ||
          !name.trim() ||
          !email.trim() ||
          password.length < 8
        }
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
