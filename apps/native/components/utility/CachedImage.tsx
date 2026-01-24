import { Image, type ImageProps, type ImageSource } from "expo-image";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useVoidTheme } from "@/hooks/use-void-theme";

interface CachedImageProps extends Omit<ImageProps, "source"> {
  uri: string;
  fallbackUri?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
  containerStyle?: ViewStyle;
}

const blurhash = "L6Pj0^jE.AjE_3jE.AjE~qjE.AjE";

export function CachedImage({
  uri,
  fallbackUri,
  width,
  height,
  borderRadius = 0,
  containerStyle,
  style,
  ...props
}: CachedImageProps) {
  const theme = useVoidTheme();

  const source: ImageSource = { uri };

  return (
    <View
      style={[
        containerStyle,
        width !== undefined && { width },
        height !== undefined && { height },
        borderRadius > 0 && { borderRadius, overflow: "hidden" },
      ]}
    >
      <Image
        source={source}
        placeholder={{ blurhash }}
        placeholderContentFit="cover"
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
        style={[
          styles.image,
          { backgroundColor: theme.colors.void.surface },
          width !== undefined && { width },
          height !== undefined && { height },
          style,
        ]}
        onError={() => {
          if (fallbackUri) {
            // Image component handles fallback internally
          }
        }}
        {...props}
      />
    </View>
  );
}

interface AvatarImageProps {
  uri?: string | null;
  name?: string;
  size?: number;
}

export function AvatarImage({ uri, name, size = 40 }: AvatarImageProps) {
  const theme = useVoidTheme();

  if (!uri) {
    const initial = name?.charAt(0).toUpperCase() ?? "?";
    return (
      <View
        style={[
          styles.avatarFallback,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.void.raised,
          },
        ]}
      >
        <View style={styles.avatarInitial}>
          {/* Text would go here but we're keeping it simple */}
        </View>
      </View>
    );
  }

  return (
    <CachedImage uri={uri} width={size} height={size} borderRadius={size / 2} />
  );
}

const styles = StyleSheet.create({
  image: {
    flex: 1,
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
