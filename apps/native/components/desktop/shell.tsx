import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MindscapeCanvas } from "@/components/desktop/mindscape";
import { WindowLayer } from "@/components/desktop/windows/layer";
import { GlobalOrb } from "@/components/orb/global";
import { useDesktopStore } from "@/store/desktop";
import { useMindscapeStore } from "@/store/mindscape";

export function DesktopShell() {
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
        <View className="absolute top-4 left-4 flex-row items-center gap-2">
          <Pressable
            className="rounded-md border border-border bg-background px-3 py-2"
            onPress={toggleMode}
          >
            <Text className="text-foreground text-sm">
              {mode === "desktop" ? "Open Mindscape" : "Back to Desktop"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Open Chat window"
            className="rounded-md border border-border bg-background px-3 py-2"
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
          >
            <Text className="text-foreground text-sm">Open Chat</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Open Terminal window"
            className="rounded-md border border-border bg-background px-3 py-2"
            onPress={() => openWindow("terminal", { label: "Terminal" })}
          >
            <Text className="text-foreground text-sm">Open Terminal</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
