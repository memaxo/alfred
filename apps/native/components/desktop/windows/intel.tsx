import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function IntelWindow({ window }: WindowComponentProps) {
  const title = (() => {
    switch (window.type) {
      case "cortex":
        return "Cortex";
      case "learning":
        return "Learning";
      case "policy":
        return "Policy";
      case "tune":
        return "Tune";
      case "plan":
        return "Plan";
      case "visual-builder":
        return "Visual Builder";
      case "metrics":
        return "Metrics";
      case "rag":
        return "RAG";
      case "bookmarks":
        return "Bookmarks";
      case "timers":
        return "Timers";
      default:
        return window.type;
    }
  })();

  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="font-semibold text-foreground">{title}</Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Native Tier-2 window is not implemented yet.
      </Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Window id: {window.id}
      </Text>
    </View>
  );
}
