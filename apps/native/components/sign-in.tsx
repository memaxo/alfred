import { signInSchema } from "@alfred/type/forms";
import { Ionicons } from "@expo/vector-icons";
import { useForm } from "@tanstack/react-form";
import { useCallback, useState } from "react";
import { ActivityIndicator, TextInput, View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  BiolumText,
  BodyText,
  CaptionText,
  TitleText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
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

const AnimatedView = Animated.createAnimatedComponent(View);

export function SignIn() {
  const authClient = useAuthClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  const errorOpacity = useSharedValue(0);
  const errorHeight = useSharedValue(0);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      setError(null);
      setDebugError(null);

      await authClient.signIn.email(
        {
          email: value.email.trim(),
          password: value.password,
        },
        {
          onError: (error: {
            error?: { message?: string };
            response?: unknown;
          }) => {
            const message = error.error?.message || "Failed to sign in";
            const resp = (error as unknown as { response?: unknown })
              .response as
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
            errorOpacity.value = withTiming(1, { duration: 200 });
            errorHeight.value = withTiming(1, { duration: 200 });
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

  const handleLogin = useCallback(() => {
    void form.handleSubmit();
  }, [form]);

  const handlePasskeyLogin = async () => {
    const email = form.state.values.email.trim();
    if (!email) {
      setError("Please enter your email to use passkey sign-in");
      errorOpacity.value = withTiming(1, { duration: 200 });
      errorHeight.value = withTiming(1, { duration: 200 });
      return;
    }

    setIsPasskeyLoading(true);
    setError(null);
    setDebugError(null);

    try {
      await authClient.signIn.passkey(
        { email: email.trim() },
        {
          onError: (error: { error?: { message?: string } }) => {
            setError(error.error?.message ?? "Passkey sign-in failed");
            setDebugError(__DEV__ ? JSON.stringify(error, null, 2) : null);
            setIsPasskeyLoading(false);
            errorOpacity.value = withTiming(1, { duration: 200 });
            errorHeight.value = withTiming(1, { duration: 200 });
          },
          onSuccess: () => {
            form.reset();
            queryClient.refetchQueries();
          },
          onFinished: () => {
            setIsPasskeyLoading(false);
          },
        }
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Passkey sign-in failed"
      );
      setDebugError(__DEV__ ? String(error) : null);
      setIsPasskeyLoading(false);
      errorOpacity.value = withTiming(1, { duration: 200 });
      errorHeight.value = withTiming(1, { duration: 200 });
    }
  };

  const isAnyLoading = isLoading || isPasskeyLoading;
  const { canSubmit } = form.state;
  const { email } = form.state.values;
  const { password } = form.state.values;

  const errorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.value,
    transform: [{ scaleY: errorHeight.value }],
  }));

  return (
    <HUDSurface elevation={2} glow={true} style={styles.container}>
      <View style={styles.header}>
        <TitleText>Sign In</TitleText>
        <CaptionText>Connect to your ALFRED server</CaptionText>
      </View>

      {error && (
        <AnimatedView style={[styles.errorContainer, errorAnimatedStyle]}>
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle" size={16} color="#FF4444" />
            <BodyText color="bright" size="small" style={styles.errorText}>
              {error}
            </BodyText>
          </View>
          {__DEV__ && debugError && (
            <CaptionText mono style={styles.debugError}>
              {debugError}
            </CaptionText>
          )}
        </AnimatedView>
      )}

      <form.Field name="email">
        {(field) => (
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIcon}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color="rgba(255,255,255,0.4)"
                />
              </View>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
                editable={!isAnyLoading}
                keyboardType="email-address"
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={field.state.value}
              />
            </View>
            {field.state.meta.errors.length > 0 && (
              <CaptionText color="faint" style={styles.inputError}>
                {errorText(field.state.meta.errors[0])}
              </CaptionText>
            )}
          </View>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="rgba(255,255,255,0.4)"
                />
              </View>
              <TextInput
                autoComplete="password"
                style={styles.input}
                editable={!isAnyLoading}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry
                value={field.state.value}
              />
            </View>
            {field.state.meta.errors.length > 0 && (
              <CaptionText color="faint" style={styles.inputError}>
                {errorText(field.state.meta.errors[0])}
              </CaptionText>
            )}
          </View>
        )}
      </form.Field>

      <FluidButton
        label={isLoading ? "" : "Sign In"}
        onPress={handleLogin}
        variant="primary"
        size="large"
        disabled={
          isAnyLoading || !canSubmit || !email.trim() || !password.trim()
        }
        style={styles.signInButton}
      >
        {isLoading ? <ActivityIndicator color="#0A0A0F" size="small" /> : null}
      </FluidButton>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <CaptionText style={styles.dividerText}>or</CaptionText>
        <View style={styles.dividerLine} />
      </View>

      <FluidButton
        label={isPasskeyLoading ? "" : "Sign in with Biometric"}
        icon={
          <Ionicons
            name="finger-print"
            size={18}
            color="rgba(255,255,255,0.8)"
          />
        }
        onPress={handlePasskeyLogin}
        variant="secondary"
        size="large"
        disabled={isAnyLoading || !email.trim()}
        style={styles.passkeyButton}
      >
        {isPasskeyLoading ? (
          <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
        ) : null}
      </FluidButton>
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 24,
  },
  header: {
    gap: 4,
    marginBottom: 24,
  },
  errorContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.2)",
  },
  errorContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    flex: 1,
  },
  debugError: {
    marginTop: 8,
    opacity: 0.7,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  inputIcon: {
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 16,
  },
  inputError: {
    marginTop: 6,
    marginLeft: 4,
  },
  signInButton: {
    width: "100%",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  dividerText: {
    marginHorizontal: 12,
  },
  passkeyButton: {
    width: "100%",
  },
});

export default SignIn;
