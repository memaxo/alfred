import type { ComponentProps } from "react";

import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Pressable } from "react-native";

const HEADER_ICON_SIZE = 20;
const HEADER_PRESSED_OPACITY = 0.7;

interface HeaderButtonProps {
  onPress?: () => void;
  pressableRef?: ComponentProps<typeof Pressable>["ref"];
}

export function HeaderButton({ onPress, pressableRef }: HeaderButtonProps) {
  return (
    <Pressable
      className="mr-2 rounded-lg bg-secondary/50 p-2 active:bg-secondary"
      onPress={onPress}
      ref={pressableRef}
    >
      {({ pressed }) => (
        <FontAwesome
          className="text-secondary-foreground"
          name="info-circle"
          size={HEADER_ICON_SIZE}
          style={{
            opacity: pressed ? HEADER_PRESSED_OPACITY : 1,
          }}
        />
      )}
    </Pressable>
  );
}
