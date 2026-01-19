import { useMemo, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useTrpcClient } from "@/lib/api";
import { useVoiceSessionNative } from "@/lib/voice/session";
import type { TRPCAppRouter } from "@/utils/trpc";
import { ORB_SIZES, ORB_STATES, Orb, type OrbState } from "./index";

type OrbLayout = "docked" | "floating" | "expanded";

function clamp(n: number, min: number, max: number) {
  if (n < min) {
    return min;
  }
  if (n > max) {
    return max;
  }
  return n;
}

function toOrbState(status: string): OrbState {
  if (status === "recording") {
    return "listening";
  }
  if (status === "playing") {
    return "speaking";
  }
  if (status === "processing" || status === "connecting") {
    return "thinking";
  }
  if (status === "error") {
    return "error";
  }
  return "idle";
}

export function GlobalOrb() {
  const { width, height } = useWindowDimensions();
  const trpcClient = useTrpcClient<TRPCAppRouter>();
  const voice = useVoiceSessionNative(trpcClient, { surface: "drive" });

  const [layout, setLayout] = useState<OrbLayout>("docked");
  const size = layout === "expanded" ? ORB_SIZES.large : ORB_SIZES.small;

  const orbState = useMemo(
    () => toOrbState(voice.stream.status),
    [voice.stream.status]
  );
  const inputVolume = useMemo(
    () => clamp(voice.stream.vadConfidence ?? 0, 0, 1),
    [voice.stream.vadConfidence]
  );

  const posX = useSharedValue(width - size - 16);
  const posY = useSharedValue(height - size - 140);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startX.value = posX.value;
          startY.value = posY.value;
        })
        .onUpdate((e) => {
          posX.value = startX.value + e.translationX;
          posY.value = startY.value + e.translationY;
        }),
    [posX, posY, startX, startY]
  );

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: posX.value,
    top: posY.value,
  }));

  const body = (
    <Pressable
      onLongPress={() =>
        setLayout((l) => (l === "floating" ? "docked" : "floating"))
      }
      onPress={() => {
        if (layout !== "expanded") {
          setLayout("expanded");
          return;
        }
        setLayout("docked");
      }}
    >
      <Orb
        inputVolume={inputVolume}
        outputVolume={voice.stream.status === "playing" ? 1 : 0}
        size={size}
        state={ORB_STATES[orbState] ? orbState : "idle"}
      />
    </Pressable>
  );

  if (layout === "expanded") {
    return (
      <View className="absolute inset-0 items-center justify-center bg-background/80">
        <View className="items-center rounded-2xl border border-border bg-background p-4">
          {body}
          <Text className="mt-3 font-medium text-foreground text-sm">
            Voice: {voice.stream.status}
          </Text>
          <Text className="mt-1 max-w-xs text-center text-muted-foreground text-xs">
            {voice.stream.transcript || voice.stream.assistantText || "…"}
          </Text>
          <View className="mt-4 flex-row gap-2">
            <Pressable
              className="rounded-md border border-border bg-background px-3 py-2"
              onPress={() =>
                voice.stream.isActive
                  ? void voice.stream.stop()
                  : void voice.stream.start()
              }
            >
              <Text className="text-foreground text-sm">
                {voice.stream.isActive ? "Stop" : "Start"}
              </Text>
            </Pressable>
            <Pressable
              className="rounded-md border border-border bg-background px-3 py-2"
              onPress={() => setLayout("docked")}
            >
              <Text className="text-foreground text-sm">Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (layout === "floating") {
    return (
      <GestureDetector gesture={drag}>
        <Animated.View style={style}>{body}</Animated.View>
      </GestureDetector>
    );
  }

  // docked
  return <View className="absolute right-4 bottom-6">{body}</View>;
}
