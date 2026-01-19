import { Pressable, Text, View } from "react-native";

export function WindowChrome({
  title,
  isFocused,
  onMinimize,
  onMaximize,
  onRestore,
  isMaximized,
  onClose,
  children,
}: {
  title: string;
  isFocused: boolean;
  isMaximized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onRestore: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <View
        className={[
          "h-10 flex-row items-center justify-between border-border border-b px-3",
          isFocused ? "bg-muted/40" : "bg-muted/20",
        ].join(" ")}
      >
        <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
          {title}
        </Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Minimize window"
            className="rounded-md bg-background px-2 py-1"
            onPress={onMinimize}
          >
            <Text className="text-foreground text-xs">Min</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={
              isMaximized ? "Restore window" : "Maximize window"
            }
            className="rounded-md bg-background px-2 py-1"
            onPress={isMaximized ? onRestore : onMaximize}
          >
            <Text className="text-foreground text-xs">
              {isMaximized ? "Restore" : "Max"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Close window"
            className="rounded-md bg-background px-2 py-1"
            onPress={onClose}
          >
            <Text className="text-foreground text-xs">Close</Text>
          </Pressable>
        </View>
      </View>
      <View className="flex-1">{children}</View>
    </View>
  );
}
