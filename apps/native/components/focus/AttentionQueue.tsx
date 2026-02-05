import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { BiolumText, CaptionText } from "@/components/foundation/BiolumText";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { useVoidTheme } from "@/hooks/use-void-theme";

interface AttentionQueueProps {
  items: {
    id: string;
    type: "reminder" | "escalation" | "review" | "workflow";
    title: string;
    urgency: "high" | "medium" | "low";
    createdAt: Date;
  }[];
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
}

interface AttentionItemProps {
  item: AttentionQueueProps["items"][number];
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
}

function getTypeIcon(type: AttentionQueueProps["items"][number]["type"]) {
  switch (type) {
    case "reminder": {
      return "time-outline";
    }
    case "escalation": {
      return "warning-outline";
    }
    case "review": {
      return "eye-outline";
    }
    case "workflow": {
      return "git-branch-outline";
    }
    default: {
      return "notifications-outline";
    }
  }
}

function getUrgencyColor(
  urgency: AttentionQueueProps["items"][number]["urgency"]
) {
  switch (urgency) {
    case "high": {
      return "#FF4444";
    }
    case "medium": {
      return "#FFB800";
    }
    case "low": {
      return "rgba(255, 255, 255, 0.4)";
    }
    default: {
      return "rgba(255, 255, 255, 0.4)";
    }
  }
}

const AttentionItem = React.memo(
  function AttentionItem({ item, onDismiss, onAction }: AttentionItemProps) {
    const theme = useVoidTheme();
    const urgencyColor = getUrgencyColor(item.urgency);
    const typeIcon = getTypeIcon(item.type);

    const handleDismiss = useCallback(() => {
      onDismiss(item.id);
    }, [item.id, onDismiss]);

    const handleAction = useCallback(() => {
      onAction(item.id);
    }, [item.id, onAction]);

    return (
      <Pressable onPress={handleAction} style={styles.itemContainer}>
        <View style={styles.itemContent}>
          <View style={styles.iconContainer}>
            <Ionicons name={typeIcon} size={20} color={urgencyColor} />
          </View>

          <View style={styles.textContainer}>
            <BiolumText variant="body" size="small" color="bright">
              {item.title}
            </BiolumText>
            <CaptionText size="small">
              {item.type} • {item.urgency}
            </CaptionText>
          </View>

          <View style={styles.actionsContainer}>
            <Pressable
              onPress={handleDismiss}
              style={({ pressed }) => [
                styles.dismissButton,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${item.title}`}
            >
              <Ionicons
                name="close-outline"
                size={20}
                color={theme.colors.biolum.dim}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.item === next.item &&
      prev.onDismiss === next.onDismiss &&
      prev.onAction === next.onAction
    );
  }
);

export function AttentionQueue({
  items,
  onDismiss,
  onAction,
}: AttentionQueueProps) {
  const theme = useVoidTheme();
  const hasUrgent = items.some((item) => item.urgency === "high");

  const renderItem = useCallback(
    ({ item }: { item: AttentionQueueProps["items"][number] }) => (
      <AttentionItem item={item} onDismiss={onDismiss} onAction={onAction} />
    ),
    [onDismiss, onAction]
  );

  const keyExtractor = useCallback(
    (item: AttentionQueueProps["items"][number]) => item.id,
    []
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <HUDSurface
      elevation={2}
      glow={hasUrgent}
      active={hasUrgent}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <BiolumText variant="title" size="small" color="bright">
            Attention Queue
          </BiolumText>
          {hasUrgent && (
            <View style={styles.urgentBadge}>
              <Ionicons name="warning" size={14} color="#FF4444" />
            </View>
          )}
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  urgentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 68, 68, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    gap: 8,
  },
  itemContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dismissButton: {
    padding: 4,
  },
});

export default AttentionQueue;
