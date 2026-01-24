import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  FlatList,
  StyleSheet,
  View,
  RefreshControl,
  Linking,
  Pressable,
} from "react-native";

import { BiolumText, CaptionText } from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { EmptyState } from "@/components/utility/EmptyState";
import { useToast } from "@/contexts/toast";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { trpc } from "@/utils/trpc";

function getDomain(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace("www.", "");
  } catch {
    return url;
  }
}

export default function BookmarksScreen() {
  const theme = useVoidTheme();
  const toast = useToast();

  // Use book.list - router is named 'book' not 'bookmark'
  const {
    data: bookmarks,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.book.list.useQuery({ limit: 50, offset: 0 });

  const handleOpenUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        toast.error("Cannot open URL", "The URL is not supported");
      }
    } catch (error) {
      toast.error("Failed to open URL", String(error));
    }
  };

  const renderItem = ({
    item,
  }: {
    item: NonNullable<typeof bookmarks>[number];
  }) => {
    const domain = getDomain(item.url);
    const tags = item.tags as string[] | null;

    return (
      <Pressable onPress={() => handleOpenUrl(item.url)}>
        <HUDSurface elevation={1} style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.colors.glass.surface },
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={20}
                color={theme.colors.biolum.standard}
              />
            </View>
            <View style={styles.cardContent}>
              <BiolumText
                variant="body"
                size="large"
                color="full"
                numberOfLines={1}
              >
                {item.title ?? domain}
              </BiolumText>
              <CaptionText size="small" color="dim" numberOfLines={1}>
                {domain}
              </CaptionText>
            </View>
            <FluidButton
              icon={
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={theme.colors.biolum.dim}
                />
              }
              variant="ghost"
              size="small"
              onPress={() => handleOpenUrl(item.url)}
            />
          </View>

          {item.description && (
            <BiolumText
              variant="body"
              size="medium"
              color="dim"
              numberOfLines={2}
              style={styles.description}
            >
              {item.description}
            </BiolumText>
          )}

          {tags && tags.length > 0 && (
            <View style={styles.tags}>
              {tags.slice(0, 4).map((tag, index) => (
                <View
                  key={index}
                  style={[
                    styles.tag,
                    { backgroundColor: theme.colors.glass.surface },
                  ]}
                >
                  <CaptionText size="small" color="dim">
                    #{tag}
                  </CaptionText>
                </View>
              ))}
              {tags.length > 4 && (
                <CaptionText size="small" color="faint">
                  +{tags.length - 4} more
                </CaptionText>
              )}
            </View>
          )}
        </HUDSurface>
      </Pressable>
    );
  };

  if (!isLoading && (!bookmarks || bookmarks.length === 0)) {
    return (
      <VoidContainer gradient="ambient" noise={true} style={styles.container}>
        <EmptyState
          icon="bookmark-outline"
          title="No bookmarks"
          message="Your bookmarks will appear here"
          actionLabel="Add Bookmark"
          onAction={() =>
            toast.info(
              "Coming soon",
              "Bookmark creation will be available soon"
            )
          }
        />
      </VoidContainer>
    );
  }

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      <FlatList
        data={bookmarks ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.biolum.standard}
          />
        }
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      <FluidButton
        icon={
          <Ionicons name="add" size={24} color={theme.colors.biolum.full} />
        }
        variant="primary"
        size="large"
        onPress={() =>
          toast.info("Coming soon", "Bookmark creation will be available soon")
        }
        style={styles.fab}
      />
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  description: {
    marginTop: 8,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
    alignItems: "center",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
  },
});
