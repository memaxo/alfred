import { Platform, TextStyle } from "react-native";

const fontFamily = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "System",
});

const monoFontFamily = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export const TYPOGRAPHY = {
  display: {
    large: {
      fontSize: 34,
      lineHeight: 41,
      fontWeight: "600" as TextStyle["fontWeight"],
      letterSpacing: 0.37,
      fontFamily,
    },
    medium: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "600" as TextStyle["fontWeight"],
      letterSpacing: 0.36,
      fontFamily,
    },
    small: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "600" as TextStyle["fontWeight"],
      letterSpacing: 0.35,
      fontFamily,
    },
  },
  title: {
    large: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "500" as TextStyle["fontWeight"],
      letterSpacing: 0.35,
      fontFamily,
    },
    medium: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "600" as TextStyle["fontWeight"],
      letterSpacing: -0.41,
      fontFamily,
    },
    small: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "600" as TextStyle["fontWeight"],
      letterSpacing: -0.24,
      fontFamily,
    },
  },
  body: {
    large: {
      fontSize: 17,
      lineHeight: 25,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: -0.41,
      fontFamily,
    },
    medium: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: -0.24,
      fontFamily,
    },
    small: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: -0.08,
      fontFamily,
    },
  },
  caption: {
    large: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: -0.08,
      fontFamily,
    },
    medium: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: 0,
      fontFamily,
    },
    small: {
      fontSize: 11,
      lineHeight: 13,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: 0.07,
      fontFamily,
    },
  },
  mono: {
    large: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: 0,
      fontFamily: monoFontFamily,
    },
    medium: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: 0,
      fontFamily: monoFontFamily,
    },
    small: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "400" as TextStyle["fontWeight"],
      letterSpacing: 0,
      fontFamily: monoFontFamily,
    },
  },
} as const;

export type Typography = typeof TYPOGRAPHY;
export type TypographyCategory = keyof Typography;
export type TypographySize = "large" | "medium" | "small";
