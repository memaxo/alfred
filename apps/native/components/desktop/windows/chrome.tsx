import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

function IconButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      className="h-8 w-8 items-center justify-center rounded-md bg-background/70"
      hitSlop={8}
      onPress={onPress}
    >
      <Ionicons color="#111827" name={icon} size={16} />
    </Pressable>
  );
}

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
    <View
      className={[
        "flex-1 overflow-hidden rounded-xl border bg-background shadow-sm",
        isFocused ? "border-primary/30" : "border-border",
      ].join(" ")}
    >
      <View
        className={[
          "h-10 flex-row items-center justify-between border-b px-3",
          isFocused
            ? "border-border bg-muted/40"
            : "border-border/60 bg-muted/20",
        ].join(" ")}
      >
        <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
          {title}
        </Text>
        <View className="flex-row items-center gap-2">
          <IconButton
            accessibilityLabel="Minimize window"
            icon="remove"
            onPress={onMinimize}
          />
          <IconButton
            accessibilityLabel={
              isMaximized ? "Restore window" : "Maximize window"
            }
            icon={isMaximized ? "contract" : "expand"}
            onPress={isMaximized ? onRestore : onMaximize}
          />
          <IconButton
            accessibilityLabel="Close window"
            icon="close"
            onPress={onClose}
          />
        </View>
      </View>
      <View className="flex-1">{children}</View>
    </View>
  );
}
