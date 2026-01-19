import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function PlaceholderWindow({ window }: WindowComponentProps) {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="font-semibold text-foreground">{window.type}</Text>
      <Text className="mt-1 text-center text-muted-foreground text-xs">
        {window.data.label ?? "Untitled"}
      </Text>
    </View>
  );
}
