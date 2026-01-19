import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function AdminWindow({ window }: WindowComponentProps) {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="font-semibold text-foreground">Admin</Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Native admin panel is not implemented yet.
      </Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Window id: {window.id}
      </Text>
    </View>
  );
}
