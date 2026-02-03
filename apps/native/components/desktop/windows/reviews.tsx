import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function ReviewsWindow(_props: WindowComponentProps) {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Text className="font-semibold text-foreground text-lg">Reviews</Text>
      <Text className="mt-2 text-center text-muted-foreground text-sm">
        Review and approve changes from agents.
      </Text>
    </View>
  );
}
