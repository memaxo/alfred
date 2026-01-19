import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function WorkWindow({ window }: WindowComponentProps) {
  const title = (() => {
    switch (window.type) {
      case "settings":
        return "Settings";
      case "components":
        return "Components";
      case "workingset":
        return "Working Set";
      case "notes":
        return "Notes";
      case "reminders":
        return "Reminders";
      case "todos":
        return "Todos";
      default:
        return window.type;
    }
  })();

  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="font-semibold text-foreground">{title}</Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Native Tier-4 window is not implemented yet.
      </Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Window id: {window.id}
      </Text>
    </View>
  );
}
