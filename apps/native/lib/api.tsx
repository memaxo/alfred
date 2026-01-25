import type { QueryClient } from "@tanstack/react-query";
import type { TRPCClient } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";

import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { NativeModules, Platform } from "react-native";

import {
  classifyServerUrl,
  normalizeServerUrl,
  resolveServerUrl,
  type ServerUrlSource,
  saveServerUrlOverride,
  type TailnetClassification,
} from "@/lib/server-url";
import { getCookieFromAuthClient } from "@/lib/voice/cookie";
import {
  createTrpcClient,
  queryClient as defaultQueryClient,
  type TRPCAppRouter,
  trpc,
} from "@/utils/trpc";

type AuthClient = ReturnType<typeof createAuthClient>;

interface ApiContextValue {
  authClient: AuthClient;
  trpcClient: TRPCClient<TRPCAppRouter>;
  serverUrl: string | null;
  serverUrlSource: ServerUrlSource;
  serverClass: TailnetClassification;
  setServerUrl: (
    input: string
  ) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  resetServerUrl: () => Promise<void>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

function isNativeTestModeEnabled() {
  if (process.env.EXPO_PUBLIC_TEST_MODE === "1") {
    return true;
  }
  if (Platform.OS !== "ios") {
    return false;
  }
  const settings = (NativeModules as unknown as { SettingsManager?: unknown })
    .SettingsManager as { settings?: Record<string, unknown> } | undefined;
  const raw = settings?.settings?.ALFRED_TEST_MODE;
  return raw === "1" || raw === "true";
}

function createTestAuthClient(): AuthClient {
  const testSession = {
    user: {
      id: "native-test-user",
      email: "native-test-user@alfred.local",
      name: "Native Test User",
      roles: ["owner"],
      scopes: [
        "assistant.write",
        "assistant.stream",
        "voice.stt",
        "voice.tts",
        "workflow.read",
        "workflow.plan",
        "workflow.execute",
      ],
    },
    session: { id: "native-test-session" },
  };

  // Minimal surface used by the app:
  // - `useSession()` gates navigation and auth UX
  // - `getCookie()` is optional (native WS) and can be null in test mode
  const client = {
    useSession: () => ({
      data: testSession,
      isPending: false,
      error: null,
    }),
    getCookie: () => null,
  };

  return client as unknown as AuthClient;
}

function getStorage() {
  if (Platform.OS === "web") {
    return {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    };
  }
  // Dynamic import to avoid loading SecureStore on web.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require("expo-secure-store");
  return SecureStore;
}

function createNativeAuthClient(baseURL: string | null): AuthClient {
  const safeBaseUrl =
    baseURL && baseURL.length > 0 ? baseURL : "http://invalid";
  return createAuthClient({
    baseURL: safeBaseUrl,
    plugins: [
      expoClient({
        scheme: "alfred",
        storagePrefix: "alfred",
        storage: getStorage(),
      }),
    ],
  });
}

export function ApiProvider({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient?: QueryClient;
}) {
  const initialEnv = process.env.EXPO_PUBLIC_SERVER_URL;
  const initialUrl =
    typeof initialEnv === "string" && initialEnv.length > 0 ? initialEnv : null;
  const initialSource: ServerUrlSource = initialUrl ? "env" : "missing";

  const [serverUrl, setServerUrlState] = useState<string | null>(initialUrl);
  const [serverUrlSource, setServerUrlSource] =
    useState<ServerUrlSource>(initialSource);

  useEffect(() => {
    const run = async () => {
      // UI tests should be deterministic and not depend on persisted storage.
      if (isNativeTestModeEnabled()) {
        setServerUrlState("http://127.0.0.1:3155");
        setServerUrlSource("env");
        return;
      }
      const resolved = await resolveServerUrl();
      setServerUrlState(resolved.url);
      setServerUrlSource(resolved.source);
    };
    void run();
  }, []);

  const authClient = useMemo(() => {
    if (isNativeTestModeEnabled()) {
      return createTestAuthClient();
    }
    return createNativeAuthClient(serverUrl);
  }, [serverUrl]);

  // Create the tRPC client from the *current* server URL and cookie accessor.
  const trpcClient = useMemo(() => {
    const baseUrl = serverUrl ?? process.env.EXPO_PUBLIC_SERVER_URL ?? "";
    return createTrpcClient(baseUrl, () => getCookieFromAuthClient(authClient));
  }, [serverUrl, authClient]);

  const serverClass = useMemo(() => {
    if (!serverUrl) {
      return {
        kind: "invalid",
        reason: "server_url_missing",
      } satisfies TailnetClassification;
    }
    return classifyServerUrl(serverUrl);
  }, [serverUrl]);

  const setServerUrl = useCallback(async (input: string) => {
    const normalized = normalizeServerUrl(input);
    if (!normalized.ok) {
      return normalized;
    }
    await saveServerUrlOverride(normalized.url);
    setServerUrlState(normalized.url);
    setServerUrlSource("override");
    return { ok: true, url: normalized.url } as const;
  }, []);

  const resetServerUrl = useCallback(async () => {
    await saveServerUrlOverride(null);
    const env = process.env.EXPO_PUBLIC_SERVER_URL;
    setServerUrlState(typeof env === "string" && env.length > 0 ? env : null);
    setServerUrlSource(
      typeof env === "string" && env.length > 0 ? "env" : "missing"
    );
  }, []);

  const value: ApiContextValue = useMemo(
    () => ({
      authClient,
      trpcClient,
      serverUrl,
      serverUrlSource,
      serverClass,
      setServerUrl,
      resetServerUrl,
    }),
    [
      authClient,
      trpcClient,
      serverUrl,
      serverUrlSource,
      serverClass,
      setServerUrl,
      resetServerUrl,
    ]
  );

  const TrpcProvider = trpc.Provider;
  const qc = queryClient ?? defaultQueryClient;
  return (
    <ApiContext.Provider value={value}>
      <TrpcProvider client={trpcClient} queryClient={qc}>
        {children}
      </TrpcProvider>
    </ApiContext.Provider>
  );
}

export function useApiContext(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error("ApiContext missing. Wrap the app in <ApiProvider>.");
  }
  return ctx;
}

export function useAuthClient(): AuthClient {
  return useApiContext().authClient;
}

export function useTrpcClient<
  TAppRouter extends AnyRouter,
>(): TRPCClient<TAppRouter> {
  return useApiContext().trpcClient as unknown as TRPCClient<TAppRouter>;
}

export function useServerUrl() {
  const {
    serverUrl,
    serverUrlSource,
    serverClass,
    setServerUrl,
    resetServerUrl,
  } = useApiContext();
  return {
    serverUrl,
    serverUrlSource,
    serverClass,
    setServerUrl,
    resetServerUrl,
  };
}
