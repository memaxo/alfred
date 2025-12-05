import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { VoiceSelector } from "@/components/voice-selector";
import { authClient } from "@/lib/auth-client";
import type { TRPCAppRouter } from "@/utils/trpc";
import { queryClient, trpc } from "@/utils/trpc";

type Passkey = {
  id: string;
  name: string | null;
  deviceType?: string;
  createdAt?: string;
};

export default function ProfileTab() {
  const { data: session } = authClient.useSession();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);

  const loadPasskeys = useCallback(async () => {
    setIsLoadingPasskeys(true);
    try {
      const result = await authClient.passkey.listUserPasskeys();
      if (result.data) {
        setPasskeys(result.data as Passkey[]);
      }
    } catch {
      // Passkeys may not be available on this device
    } finally {
      setIsLoadingPasskeys(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadPasskeys();
    }
  }, [session?.user, loadPasskeys]);

  const handleAddPasskey = async () => {
    setIsAddingPasskey(true);
    try {
      const result = await authClient.passkey.addPasskey({
        name: `Device ${new Date().toLocaleDateString()}`,
      });
      if (result.data) {
        Alert.alert("Success", "Passkey added successfully");
        loadPasskeys();
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to add passkey"
      );
    } finally {
      setIsAddingPasskey(false);
    }
  };

  const handleDeletePasskey = (passkeyId: string, name: string | null) => {
    Alert.alert(
      "Delete Passkey",
      `Are you sure you want to delete "${name || "this passkey"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await authClient.passkey.deletePasskey({ id: passkeyId });
              loadPasskeys();
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to delete passkey"
              );
            }
          },
        },
      ]
    );
  };

  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type PrivateDataOutput = RouterOutputs["privateData"];

  const privateDataQuery = trpc.privateData.useQuery() as {
    data: PrivateDataOutput | undefined;
    isLoading: boolean;
  };
  const { data: privateData, isLoading: isPrivateLoading } = privateDataQuery;

  // Preference queries
  const preferenceQuery = trpc.preference.list.useQuery({
    limit: 100,
    offset: 0,
  });
  const setPreference = trpc.preference.set.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["preference", "list"]] });
    },
  });

  const currentVoice = (() => {
    const pref = preferenceQuery.data?.find((p) => p.key === "voice.tts");
    if (!pref?.value) {
      return;
    }
    if (typeof pref.value === "string") {
      try {
        if (pref.value.startsWith('"') && pref.value.endsWith('"')) {
          return JSON.parse(pref.value);
        }
      } catch {
        // ignore
      }
      return pref.value;
    }
    return;
  })();

  const currentLanguage = (() => {
    const pref = preferenceQuery.data?.find(
      (p) => p.key === "voice.stt.language"
    );
    if (!pref?.value) {
      return;
    }
    if (typeof pref.value === "string") {
      try {
        if (pref.value.startsWith('"') && pref.value.endsWith('"')) {
          return JSON.parse(pref.value);
        }
      } catch {
        // ignore
      }
      return pref.value;
    }
    return;
  })();

  const handleVoiceChange = (voice: string) => {
    setPreference.mutate({
      key: "voice.tts",
      value: voice,
      confidence: 1,
      source: "user",
    });
  };

  const handleLanguageChange = (lang: string) => {
    setPreference.mutate({
      key: "voice.stt.language",
      value: lang,
      confidence: 1,
      source: "user",
    });
  };

  if (!session?.user) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-muted-foreground">
            Please sign in to view your profile.
          </Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollView className="flex-1 p-6">
        <View className="mb-6">
          <Text className="mb-2 font-bold text-3xl text-foreground">
            Profile
          </Text>
          <Text className="text-lg text-muted-foreground">
            Manage your account and settings
          </Text>
        </View>

        <View className="mb-6 rounded-lg border border-border bg-card p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base text-foreground">
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

        <View className="mb-6 rounded-lg border border-border p-4">
          <Text className="mb-3 font-medium text-foreground">
            Voice Settings
          </Text>
          <View className="space-y-4">
            <View>
              <Text className="mb-2 text-muted-foreground text-sm">
                TTS Voice
              </Text>
              <VoiceSelector
                onValueChange={handleVoiceChange}
                value={currentVoice as string | undefined}
              />
            </View>
            <View>
              <Text className="mb-2 text-muted-foreground text-sm">
                STT Language
              </Text>
              <TextInput
                className="rounded-md border border-border bg-background px-4 py-3 text-foreground"
                onChangeText={handleLanguageChange}
                placeholder="e.g. en, es, fr (Auto if empty)"
                placeholderTextColor="#666"
                value={(currentLanguage as string) ?? ""}
              />
            </View>
          </View>
        </View>

        <View className="mb-6 rounded-lg border border-border p-4">
          <Text className="mb-3 font-medium text-foreground">Private Data</Text>
          {!isPrivateLoading && privateData && (
            <View>
              <Text className="text-muted-foreground">
                {privateData.message}
              </Text>
            </View>
          )}
        </View>

        <View className="mb-6 rounded-lg border border-border p-4">
          <Text className="mb-3 font-medium text-foreground">
            Security - Passkeys
          </Text>
          <Text className="mb-4 text-muted-foreground text-sm">
            Passkeys let you sign in with Face ID or Touch ID instead of a
            password.
          </Text>

          {isLoadingPasskeys ? (
            <ActivityIndicator size="small" />
          ) : passkeys.length > 0 ? (
            <View className="mb-4 space-y-2">
              {passkeys.map((pk) => (
                <View
                  className="flex-row items-center justify-between rounded-md border border-border bg-background p-3"
                  key={pk.id}
                >
                  <View className="flex-1">
                    <Text className="font-medium text-foreground">
                      {pk.name || "Unnamed Device"}
                    </Text>
                    {pk.createdAt && (
                      <Text className="text-muted-foreground text-xs">
                        Added {new Date(pk.createdAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    className="rounded-md bg-destructive/10 px-3 py-2"
                    onPress={() => handleDeletePasskey(pk.id, pk.name)}
                  >
                    <Text className="text-destructive text-sm">Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text className="mb-4 text-muted-foreground text-sm">
              No passkeys registered yet.
            </Text>
          )}

          <TouchableOpacity
            className="flex-row items-center justify-center rounded-md bg-primary px-4 py-3"
            disabled={isAddingPasskey}
            onPress={handleAddPasskey}
          >
            {isAddingPasskey ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="font-medium text-primary-foreground">
                Add Passkey (Face ID / Touch ID)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Container>
  );
}
