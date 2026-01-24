export { VOID_PALETTE, ATTENTION_SCALE, GLOW, oklchToRgb } from "./colors";
export type { VoidPalette, GlowStyle } from "./colors";

export { TYPOGRAPHY } from "./typography";
export type {
  Typography,
  TypographyCategory,
  TypographySize,
} from "./typography";

export { SPACING, RADII, TOUCH_TARGETS, SAFE_AREA } from "./spacing";
export type { Spacing, Radii, TouchTargets } from "./spacing";

export { EASING, DURATION, SPRING_CONFIG } from "./animation";
export type { EasingType, DurationType, SpringConfigType } from "./animation";

export const VoidTheme = {
  colors: require("./colors").VOID_PALETTE,
  typography: require("./typography").TYPOGRAPHY,
  spacing: require("./spacing").SPACING,
  radii: require("./spacing").RADII,
  touchTargets: require("./spacing").TOUCH_TARGETS,
  animation: {
    easing: require("./animation").EASING,
    duration: require("./animation").DURATION,
    spring: require("./animation").SPRING_CONFIG,
  },
  glow: require("./colors").GLOW,
} as const;

export type VoidThemeType = typeof VoidTheme;
