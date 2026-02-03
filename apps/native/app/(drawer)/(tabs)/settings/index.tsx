import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ScrollView, View, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  VoidContainer,
  HUDSurface,
  TitleText,
  BodyText,
  CaptionText,
} from "@/components/foundation";

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  showChevron?: boolean;
}

function SettingsRow({
  icon,
  label,
  description,
  showChevron,
}: SettingsRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color="rgba(255,255,255,0.6)" />
      </View>
      <View style={styles.rowContent}>
        <BodyText>{label}</BodyText>
        {description && <CaptionText color="dim">{description}</CaptionText>}
      </View>
      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color="rgba(255,255,255,0.3)"
        />
      )}
    </View>
  );
}

export default function SettingsIndex() {
  return (
    <VoidContainer gradient="ambient" noise={true} noiseOpacity={0.03}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TitleText size="large">Settings</TitleText>
            <CaptionText color="dim">
              Configure your ALFRED experience
            </CaptionText>
          </View>

          {/* Section: Server */}
          <View style={styles.section}>
            <CaptionText style={styles.sectionTitle}>SERVER</CaptionText>
            <HUDSurface elevation={1} style={styles.sectionCard}>
              <Link asChild href="/(drawer)/(tabs)/settings/server">
                <Pressable
                  style={({ pressed }) => [pressed && styles.rowPressed]}
                >
                  <SettingsRow
                    icon="server-outline"
                    label="Server"
                    description="Set the ALFRED server URL"
                    showChevron
                  />
                </Pressable>
              </Link>
            </HUDSurface>
          </View>

          {/* Section: Preferences */}
          <View style={styles.section}>
            <CaptionText style={styles.sectionTitle}>PREFERENCES</CaptionText>
            <HUDSurface elevation={1} style={styles.sectionCard}>
              <Link asChild href="/(drawer)/(tabs)/settings/preferences">
                <Pressable
                  style={({ pressed }) => [pressed && styles.rowPressed]}
                >
                  <SettingsRow
                    icon="options-outline"
                    label="Preferences"
                    description="Customize assistant behavior"
                    showChevron
                  />
                </Pressable>
              </Link>
            </HUDSurface>
          </View>

          {/* Section: Privacy */}
          <View style={styles.section}>
            <CaptionText style={styles.sectionTitle}>PRIVACY</CaptionText>
            <HUDSurface elevation={1} style={styles.sectionCard}>
              <Link asChild href="/(drawer)/(tabs)/settings/privacy">
                <Pressable
                  style={({ pressed }) => [pressed && styles.rowPressed]}
                >
                  <SettingsRow
                    icon="shield-outline"
                    label="Privacy & Data"
                    description="Control data sharing and retention"
                    showChevron
                  />
                </Pressable>
              </Link>
            </HUDSurface>
          </View>

          {/* Section: About */}
          <View style={styles.section}>
            <CaptionText style={styles.sectionTitle}>ABOUT</CaptionText>
            <HUDSurface elevation={1} style={styles.sectionCard}>
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color="rgba(255,255,255,0.6)"
                  />
                </View>
                <View style={styles.rowContent}>
                  <BodyText>Version</BodyText>
                </View>
                <CaptionText color="dim">1.0.0</CaptionText>
              </View>
            </HUDSurface>
          </View>
        </ScrollView>
      </SafeAreaView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 1,
  },
  sectionCard: {
    padding: 0,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  rowPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rowIcon: {
    width: 32,
    alignItems: "center",
  },
  rowContent: {
    flex: 1,
    marginLeft: 8,
  },
});
