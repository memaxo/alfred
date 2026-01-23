import { Pressable, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { MindscapeCanvas } from "@/components/desktop/mindscape";
import { WindowLayer } from "@/components/desktop/windows/layer";
import { GlobalOrb } from "@/components/orb/global";
import { useDesktopStore } from "@/store/desktop";
import { useMindscapeStore } from "@/store/mindscape";

function ShellButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      className="rounded-md border border-border bg-background/80 px-3 py-2"
      onPress={onPress}
    >
      <Text className="text-foreground text-sm">{label}</Text>
    </Pressable>
  );
}

export function DesktopShell() {
  const insets = useSafeAreaInsets();
  const mode = useDesktopStore((s) => s.mode);
  const toggleMode = useDesktopStore((s) => s.toggleMode);
  const openWindow = useDesktopStore((s) => s.openWindow);
  const spawnFromWindow = useMindscapeStore((s) => s.spawnFromWindow);
  const addEdge = useMindscapeStore((s) => s.addEdge);
  const pulseEdge = useMindscapeStore((s) => s.pulseEdge);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="relative flex-1 overflow-hidden">
        {/* Background layer */}
        <View className="absolute inset-0 bg-background" />

        {/* Mindscape layer */}
        {mode === "mindscape" ? (
          <View className="absolute inset-0">
            <MindscapeCanvas />
          </View>
        ) : null}

        {/* Window layer */}
        {mode === "desktop" ? (
          <View className="absolute inset-0">
            <WindowLayer />
          </View>
        ) : null}

        {/* Orb layer */}
        <GlobalOrb />

        {/* Overlay layer */}
        <View
          className="absolute flex-row items-center gap-2"
          style={{ left: 16, top: insets.top + 12 }}
        >
          <ShellButton
            label={mode === "desktop" ? "Open Mindscape" : "Back to Desktop"}
            onPress={toggleMode}
          />
          <ShellButton
            accessibilityLabel="Open Chat window"
            label="Chat"
            onPress={() => {
              const id = openWindow("chat", { label: "Chat" });
              const nodeId = spawnFromWindow({
                windowId: id,
                label: "Chat",
                windowType: "chat",
              });
              const edgeId = `edge_root_${nodeId}`;
              const has = useMindscapeStore
                .getState()
                .edges.some((e) => e.id === edgeId);
              if (!has) {
                addEdge({
                  id: edgeId,
                  source: "root",
                  target: nodeId,
                  data: { type: "spawn", label: "spawn" },
                });
              }
              pulseEdge(edgeId);
            }}
          />
          <ShellButton
            accessibilityLabel="Open Components window"
            label="Launcher"
            onPress={() => openWindow("components", { label: "Components" })}
          />
          <ShellButton
            accessibilityLabel="Open Terminal window"
            label="Terminal"
            onPress={() => openWindow("terminal", { label: "Terminal" })}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
