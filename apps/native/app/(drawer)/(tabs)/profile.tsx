import type { inferRouterOutputs } from "@trpc/server";

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  View,
  StyleSheet,
} from "react-native";

import type { TRPCAppRouter } from "@/utils/trpc";

import { Choice } from "@/components/form/Choice";
import { TextInput as VoidTextInput } from "@/components/form/TextInput";
import {
  BiolumText,
  CaptionText,
  DisplayText,
  TitleText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { GlowBorder } from "@/components/foundation/GlowBorder";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { VoiceSelector } from "@/components/voice-selector";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { useAuthClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

interface Passkey {
  id: string;
  name: string | null;
  deviceType?: string;
  createdAt?: string;
}

export default function ProfileTab() {
  const theme = useVoidTheme();
  const authClient = useAuthClient();
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
      // Passkeys may not be available
    } finally {
      setIsLoadingPasskeys(false);
    }
  }, [authClient]);

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
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to add passkey"
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
            } catch (error) {
              Alert.alert(
                "Error",
                error instanceof Error
                  ? error.message
                  : "Failed to delete passkey"
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
        /* ignore */
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
        /* ignore */
      }
      return pref.value;
    }
    return;
  })();

  const currentChunkSize = (() => {
    const pref = preferenceQuery.data?.find(
      (p) => p.key === "voice.stt.chunk_size"
    );
    const value = pref?.value;
    const raw = typeof value === "string" ? value : "";
    const parsed = (() => {
      try {
        if (raw.startsWith('"') && raw.endsWith('"')) {
          return JSON.parse(raw) as unknown;
        }
      } catch {
        /* ignore */
      }
      return raw;
    })();
    return parsed === "fast" ||
      parsed === "low" ||
      parsed === "medium" ||
      parsed === "accurate"
      ? parsed
      : "medium";
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

  const handleChunkSizeChange = (size: string) => {
    setPreference.mutate({
      key: "voice.stt.chunk_size",
      value: size,
      confidence: 1,
      source: "user",
    });
  };

  if (!session?.user) {
    return (
      <VoidContainer gradient="ambient" noise={true} style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons
            name="person-outline"
            size={48}
            color={theme.colors.biolum.faint}
          />
          <BiolumText
            variant="body"
            size="large"
            color="dim"
            style={styles.emptyText}
          >
            Please sign in to view your profile.
          </BiolumText>
        </View>
      </VoidContainer>
    );
  }

  const chunkSizeOptions = [
    { value: "fast", label: "Fast" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "accurate", label: "Accurate" },
  ];

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TitleText size="large" color="full">
            Profile
          </TitleText>
          <CaptionText size="medium" color="dim">
            Manage your account and settings
          </CaptionText>
        </View>

        {/* User Info */}
        <HUDSurface elevation={2} style={styles.card}>
          <View style={styles.userHeader}>
            <GlowBorder
              active
              pulsing
              color={theme.colors.accent.cyan}
              borderRadius={32}
              borderWidth={2}
              style={styles.avatarGlow}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: theme.colors.glass.surface },
                ]}
              >
                <Ionicons
                  name="person"
                  size={32}
                  color={theme.colors.biolum.standard}
                />
              </View>
            </GlowBorder>
            <View style={styles.userInfo}>
              <DisplayText size="medium" color="full">
                {session.user.name}
              </DisplayText>
              <CaptionText size="medium" color="dim" mono>
                {session.user.email}
              </CaptionText>
            </View>
          </View>
          <FluidButton
            label="Sign Out"
            variant="secondary"
            size="medium"
            onPress={() => {
              authClient.signOut();
              queryClient.invalidateQueries();
            }}
            style={styles.signOutButton}
          />
        </HUDSurface>

        {/* Voice Settings */}
        <HUDSurface elevation={1} style={styles.card}>
          <BiolumText
            variant="body"
            size="large"
            color="full"
            style={styles.sectionTitle}
          >
            Voice Settings
          </BiolumText>

          <View style={styles.field}>
            <CaptionText size="small" color="faint" style={styles.fieldLabel}>
              TTS Voice
            </CaptionText>
            <VoiceSelector
              onValueChange={handleVoiceChange}
              value={currentVoice as string | undefined}
            />
          </View>

          <View style={styles.field}>
            <VoidTextInput
              label="STT Language"
              value={(currentLanguage as string) ?? ""}
              onChangeText={handleLanguageChange}
              placeholder="e.g. en, es, fr (Auto if empty)"
            />
          </View>

          <View style={styles.field}>
            <CaptionText size="small" color="faint" style={styles.fieldLabel}>
              STT Chunk Size
            </CaptionText>
            <Choice
              options={chunkSizeOptions}
              value={currentChunkSize}
              onChange={(v) =>
                handleChunkSizeChange(typeof v === "string" ? v : v[0])
              }
            />
            <CaptionText size="small" color="faint" style={styles.hint}>
              Smaller chunks reduce latency but may reduce accuracy.
            </CaptionText>
          </View>
        </HUDSurface>

        {/* Private Data */}
        {!isPrivateLoading && privateData && (
          <HUDSurface elevation={1} style={styles.card}>
            <BiolumText
              variant="body"
              size="large"
              color="full"
              style={styles.sectionTitle}
            >
              Private Data
            </BiolumText>
            <BiolumText variant="body" size="medium" color="dim">
              {privateData.message}
            </BiolumText>
          </HUDSurface>
        )}

        {/* Passkeys */}
        <HUDSurface elevation={1} style={styles.card}>
          <BiolumText
            variant="body"
            size="large"
            color="full"
            style={styles.sectionTitle}
          >
            Security - Passkeys
          </BiolumText>
          <CaptionText size="medium" color="dim" style={styles.passkeyHint}>
            Passkeys let you sign in with Face ID or Touch ID instead of a
            password.
          </CaptionText>

          {isLoadingPasskeys ? (
            <ActivityIndicator color={theme.colors.biolum.standard} />
          ) : passkeys.length > 0 ? (
            <View style={styles.passkeyList}>
              {passkeys.map((pk) => (
                <View
                  key={pk.id}
                  style={[
                    styles.passkeyItem,
                    { borderColor: theme.colors.glass.border },
                  ]}
                >
                  <View style={styles.passkeyInfo}>
                    <BiolumText variant="body" size="medium" color="standard">
                      {pk.name || "Unnamed Device"}
                    </BiolumText>
                    {pk.createdAt && (
                      <CaptionText size="small" color="faint">
                        Added {new Date(pk.createdAt).toLocaleDateString()}
                      </CaptionText>
                    )}
                  </View>
                  <FluidButton
                    label="Remove"
                    variant="ghost"
                    size="small"
                    onPress={() => handleDeletePasskey(pk.id, pk.name)}
                  />
                </View>
              ))}
            </View>
          ) : (
            <CaptionText size="medium" color="dim" style={styles.noPasskeys}>
              No passkeys registered yet.
            </CaptionText>
          )}

          <FluidButton
            label={
              isAddingPasskey ? "Adding..." : "Add Passkey (Face ID / Touch ID)"
            }
            variant="primary"
            size="medium"
            onPress={handleAddPasskey}
            disabled={isAddingPasskey}
            style={styles.addPasskeyButton}
          />
        </HUDSurface>
      </ScrollView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    textAlign: "center",
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarGlow: {
    borderRadius: 32,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  signOutButton: {
    alignSelf: "flex-start",
  },
  sectionTitle: {
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  hint: {
    marginTop: 8,
  },
  passkeyHint: {
    marginBottom: 16,
  },
  passkeyList: {
    gap: 8,
    marginBottom: 16,
  },
  passkeyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  passkeyInfo: {
    flex: 1,
  },
  noPasskeys: {
    marginBottom: 16,
  },
  addPasskeyButton: {
    marginTop: 8,
  },
});
