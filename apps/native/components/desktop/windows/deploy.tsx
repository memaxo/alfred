import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function DeployWindow(_props: WindowComponentProps) {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Text className="font-semibold text-foreground text-lg">Deploy</Text>
      <Text className="mt-2 text-center text-muted-foreground text-sm">
        Deployment management and container orchestration.
      </Text>
    </View>
  );
}
