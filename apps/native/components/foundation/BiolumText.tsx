import type { TextStyle } from "react-native";

import React from "react";
import { Text, StyleSheet } from "react-native";

import type {
  TypographyCategory,
  TypographySize,
} from "../../theme/typography";

import { useVoidTheme } from "../../hooks/use-void-theme";

type BiolumColor = "full" | "bright" | "standard" | "dim" | "faint" | "whisper";

interface BiolumTextProps {
  variant?: TypographyCategory;
  size?: TypographySize;
  color?: BiolumColor;
  mono?: boolean;
  children: React.ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
  selectable?: boolean;
}

export function BiolumText({
  variant = "body",
  size = "medium",
  color = "standard",
  mono = false,
  children,
  style,
  numberOfLines,
  selectable = false,
}: BiolumTextProps) {
  const theme = useVoidTheme();

  const typographyStyle = mono
    ? theme.typography.mono[size]
    : theme.typography[variant][size];
  const textColor = theme.colors.biolum[color];

  return (
    <Text
      style={[typographyStyle, { color: textColor }, style]}
      numberOfLines={numberOfLines}
      selectable={selectable}
    >
      {children}
    </Text>
  );
}

// Convenience components for common use cases
export function DisplayText({
  size = "medium",
  children,
  style,
  ...props
}: Omit<BiolumTextProps, "variant">) {
  return (
    <BiolumText
      variant="display"
      size={size}
      color="full"
      style={style}
      {...props}
    >
      {children}
    </BiolumText>
  );
}

export function TitleText({
  size = "medium",
  children,
  style,
  ...props
}: Omit<BiolumTextProps, "variant">) {
  return (
    <BiolumText
      variant="title"
      size={size}
      color="bright"
      style={style}
      {...props}
    >
      {children}
    </BiolumText>
  );
}

export function BodyText({
  size = "medium",
  children,
  style,
  ...props
}: Omit<BiolumTextProps, "variant">) {
  return (
    <BiolumText
      variant="body"
      size={size}
      color="standard"
      style={style}
      {...props}
    >
      {children}
    </BiolumText>
  );
}

export function CaptionText({
  size = "medium",
  children,
  style,
  ...props
}: Omit<BiolumTextProps, "variant">) {
  return (
    <BiolumText
      variant="caption"
      size={size}
      color="dim"
      style={style}
      {...props}
    >
      {children}
    </BiolumText>
  );
}

export function MonoText({
  size = "medium",
  children,
  style,
  ...props
}: Omit<BiolumTextProps, "variant" | "mono">) {
  return (
    <BiolumText mono size={size} color="faint" style={style} {...props}>
      {children}
    </BiolumText>
  );
}

export default BiolumText;
