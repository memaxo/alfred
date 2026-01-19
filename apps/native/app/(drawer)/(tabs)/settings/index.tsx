import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Container } from "@/components/container";

export default function SettingsIndex() {
  return (
    <Container>
      <ScrollView className="flex-1 p-6">
        <Text className="mb-2 font-bold text-3xl text-foreground">
          Settings
        </Text>
        <Text className="mb-6 text-muted-foreground">
          Configure your server, preferences, and privacy.
        </Text>

        <View className="space-y-3">
          <Link asChild href="/(drawer)/(tabs)/settings/server">
            <View className="rounded-lg border border-border bg-card p-4">
              <Text className="font-medium text-foreground">Server</Text>
              <Text className="mt-1 text-muted-foreground text-sm">
                Set the ALFRED server URL (Tailscale recommended)
              </Text>
            </View>
          </Link>

          <Link asChild href="/(drawer)/(tabs)/settings/preferences">
            <View className="rounded-lg border border-border bg-card p-4">
              <Text className="font-medium text-foreground">Preferences</Text>
              <Text className="mt-1 text-muted-foreground text-sm">
                Customize assistant behavior
              </Text>
            </View>
          </Link>

          <Link asChild href="/(drawer)/(tabs)/settings/privacy">
            <View className="rounded-lg border border-border bg-card p-4">
              <Text className="font-medium text-foreground">Privacy</Text>
              <Text className="mt-1 text-muted-foreground text-sm">
                Control data sharing and retention
              </Text>
            </View>
          </Link>
        </View>
      </ScrollView>
    </Container>
  );
}
