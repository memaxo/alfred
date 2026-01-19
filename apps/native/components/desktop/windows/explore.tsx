import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function ExploreWindow({ window }: WindowComponentProps) {
  const title = (() => {
    switch (window.type) {
      case "knowledge":
        return "Knowledge";
      case "workflow":
        return "Workflow";
      case "linear":
        return "Linear";
      case "concept":
        return "Concept";
      case "project":
        return "Project";
      default:
        return window.type;
    }
  })();

  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="font-semibold text-foreground">{title}</Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Native Tier-3 window is not implemented yet.
      </Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Window id: {window.id}
      </Text>
    </View>
  );
}
