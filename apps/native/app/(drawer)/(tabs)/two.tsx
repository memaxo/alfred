import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ScrollView,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";

import {
  BiolumText,
  CaptionText,
  TitleText,
} from "@/components/foundation/BiolumText";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { trpc } from "@/utils/trpc";

interface LibrarySection {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  route: string;
}

const LIBRARY_SECTIONS: LibrarySection[] = [
  {
    id: "notes",
    title: "Notes",
    icon: "document-text-outline",
    description: "Quick thoughts and ideas",
    route: "/(drawer)/library/notes",
  },
  {
    id: "reminders",
    title: "Reminders",
    icon: "alarm-outline",
    description: "Time-based notifications",
    route: "/(drawer)/library/reminders",
  },
  {
    id: "timers",
    title: "Timers",
    icon: "timer-outline",
    description: "Countdown and stopwatch",
    route: "/(drawer)/library/timers",
  },
  {
    id: "bookmarks",
    title: "Bookmarks",
    icon: "bookmark-outline",
    description: "Saved links and references",
    route: "/(drawer)/library/bookmarks",
  },
];

export default function TabTwo() {
  const theme = useVoidTheme();
  const router = useRouter();

  // Fetch counts for each section
  const notesQuery = trpc.note.list.useQuery({ limit: 1, offset: 0 });
  const remindersQuery = trpc.remind.list.useQuery({ limit: 1, offset: 0 });
  const timersQuery = trpc.timer.active.useQuery({});
  const bookmarksQuery = trpc.book.list.useQuery({ limit: 1, offset: 0 });

  const getCounts = () => ({
    notes: notesQuery.data?.length ?? 0,
    reminders: remindersQuery.data?.length ?? 0,
    timers: timersQuery.data?.length ?? 0,
    bookmarks: bookmarksQuery.data?.length ?? 0,
  });

  const isLoading =
    notesQuery.isLoading ||
    remindersQuery.isLoading ||
    timersQuery.isLoading ||
    bookmarksQuery.isLoading;

  const counts = getCounts();

  const handleSectionPress = (route: string) => {
    router.push(route as any);
  };

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TitleText size="large" color="full">
            Library
          </TitleText>
          <CaptionText size="medium" color="dim">
            Discover more features and content
          </CaptionText>
        </View>

        {/* Library Sections */}
        {LIBRARY_SECTIONS.map((section) => {
          const count = counts[section.id as keyof typeof counts];

          return (
            <Pressable
              key={section.id}
              onPress={() => handleSectionPress(section.route)}
            >
              <HUDSurface elevation={1} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: theme.colors.glass.surface },
                    ]}
                  >
                    <Ionicons
                      name={section.icon}
                      size={24}
                      color={theme.colors.biolum.standard}
                    />
                  </View>
                  <View style={styles.sectionInfo}>
                    <BiolumText variant="body" size="large" color="full">
                      {section.title}
                    </BiolumText>
                    <CaptionText size="medium" color="dim">
                      {section.description}
                    </CaptionText>
                  </View>

                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.biolum.faint}
                    />
                  ) : (count > 0 ? (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: theme.colors.glass.active },
                      ]}
                    >
                      <BiolumText variant="caption" size="small" color="full">
                        {count}
                      </BiolumText>
                    </View>
                  ) : null)}

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.biolum.faint}
                    style={styles.chevron}
                  />
                </View>
              </HUDSurface>
            </Pressable>
          );
        })}

        {/* Coming Soon Section */}
        <HUDSurface elevation={1} style={styles.comingSoonCard}>
          <View style={styles.comingSoonHeader}>
            <Ionicons
              name="sparkles-outline"
              size={24}
              color={theme.colors.biolum.bright}
            />
            <BiolumText
              variant="body"
              size="large"
              color="bright"
              style={styles.comingSoonTitle}
            >
              Coming Soon
            </BiolumText>
          </View>
          <CaptionText size="medium" color="dim">
            More library features are on the way. Stay tuned for updates!
          </CaptionText>
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
  sectionCard: {
    marginBottom: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  comingSoonCard: {
    marginTop: 8,
    padding: 16,
  },
  comingSoonHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  comingSoonTitle: {
    marginLeft: 8,
  },
});
