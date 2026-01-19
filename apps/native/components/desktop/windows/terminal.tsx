import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function TerminalWindow({ window }: WindowComponentProps) {
  return (
    <View className="flex-1 px-3 py-2">
      <View className="flex-1 rounded-lg border border-border bg-muted/20 p-3">
        <Text className="font-mono text-muted-foreground text-xs">
          alfred $ echo "terminal stub"
        </Text>
        <Text className="mt-2 font-mono text-muted-foreground text-xs">
          TODO: attach to server-side terminal sessions
        </Text>
        <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
          window={window.id}
        </Text>
      </View>
    </View>
  );
}
