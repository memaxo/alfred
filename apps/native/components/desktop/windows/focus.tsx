import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function FocusWindow(_props: WindowComponentProps) {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Text className="font-semibold text-foreground text-lg">Focus</Text>
      <Text className="mt-2 text-center text-muted-foreground text-sm">
        Distraction-free focus mode for deep work sessions.
      </Text>
    </View>
  );
}
