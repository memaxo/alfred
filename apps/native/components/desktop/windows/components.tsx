import { useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDesktopStore } from "@/store/desktop";
import type { WindowType } from "@/store/desktop.types";
import { windowParity } from "./parity";
import type { WindowComponentProps } from "./types";

export function ComponentsWindow(_props: WindowComponentProps) {
  const openWindow = useDesktopStore((s) => s.openWindow);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = Object.keys(windowParity) as WindowType[];
    const needle = q.trim().toLowerCase();
    const filtered = needle.length
      ? all.filter((t) => t.toLowerCase().includes(needle))
      : all;
    return filtered.sort((a, b) => a.localeCompare(b));
  }, [q]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">
          Components
        </Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Window launcher + parity checklist reference.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setQ}
          placeholder="Search windows…"
          placeholderTextColor="#6b7280"
          value={q}
        />
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">
          Window types ({list.length})
        </Text>
        <View className="mt-3 gap-2">
          {list.map((type) => {
            const meta = windowParity[type];
            return (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={type}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <Text className="font-medium text-foreground text-sm">
                      {type}
                    </Text>
                    <Text className="mt-1 text-[10px] text-muted-foreground">
                      web: {meta.kind} • {meta.webPath}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel={`Open ${type} window`}
                    className="rounded-md bg-secondary px-3 py-2"
                    onPress={() =>
                      openWindow(type, {
                        label: meta.kind === "app" ? type : type,
                      })
                    }
                  >
                    <Text className="text-secondary-foreground text-xs">
                      Open
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text className="mt-2 text-[10px] text-muted-foreground">
                  contract: {meta.contract.join(", ")}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
