import type { inferRouterOutputs } from "@trpc/server";
import { ScrollView, Text, TouchableOpacity, View, TextInput } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { VoiceSelector } from "@/components/voice-selector";
import { authClient } from "@/lib/auth-client";
import type { TRPCAppRouter } from "@/utils/trpc";
import { queryClient, trpc } from "@/utils/trpc";

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

  // Preference queries
  const preferenceQuery = trpc.preference.list.useQuery({ limit: 100, offset: 0 });
  const setPreference = trpc.preference.set.useMutation({
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["preference", "list"]] });
    }
  });

  const currentVoice = (() => {
    const pref = preferenceQuery.data?.find(p => p.key === "voice.tts");
    if (!pref?.value) return undefined;
    if (typeof pref.value === "string") {
      try {
        if (pref.value.startsWith('"') && pref.value.endsWith('"')) {
             return JSON.parse(pref.value);
        }
      } catch {}
      return pref.value;
    }
    return undefined;
  })();

  const currentLanguage = (() => {
    const pref = preferenceQuery.data?.find(p => p.key === "voice.stt.language");
    if (!pref?.value) return undefined;
    if (typeof pref.value === "string") {
      try {
        if (pref.value.startsWith('"') && pref.value.endsWith('"')) {
             return JSON.parse(pref.value);
        }
      } catch {}
      return pref.value;
    }
    return undefined;
  })();

  const handleVoiceChange = (voice: string) => {
     setPreference.mutate({
         key: "voice.tts",
         value: voice,
         confidence: 1,
         source: "user"
     });
  };

  const handleLanguageChange = (lang: string) => {
    setPreference.mutate({
        key: "voice.stt.language",
        value: lang,
        confidence: 1,
        source: "user"
    });
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
          {session?.user ? (
            <View className="mb-6 rounded-lg border border-border bg-card p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-base text-foreground">
                  Welcome,{" "}
                  <Text className="font-medium">{session.user.name}</Text>
                </Text>
              </View>
              <Text className="mb-4 text-muted-foreground text-sm">
                {session.user.email}
              </Text>

              <TouchableOpacity
                className="self-start rounded-md bg-destructive px-4 py-2"
                onPress={() => {
                  authClient.signOut();
                  queryClient.invalidateQueries();
                }}
              >
                <Text className="font-medium text-white">Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {session?.user && (
            <View className="mb-6 rounded-lg border border-border p-4">
                <Text className="mb-3 font-medium text-foreground">Voice Settings</Text>
                <View className="space-y-4">
                    <View>
                        <Text className="mb-2 text-sm text-muted-foreground">TTS Voice</Text>
                        <VoiceSelector 
                            value={currentVoice as string | undefined}
                            onValueChange={handleVoiceChange}
                        />
                    </View>
                    <View>
                        <Text className="mb-2 text-sm text-muted-foreground">STT Language</Text>
                        <TextInput
                            className="rounded-md border border-border bg-background px-4 py-3 text-foreground"
                            placeholder="e.g. en, es, fr (Auto if empty)"
                            value={(currentLanguage as string) ?? ""}
                            onChangeText={handleLanguageChange}
                            placeholderTextColor="#666"
                        />
                    </View>
                </View>
            </View>
          )}

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
