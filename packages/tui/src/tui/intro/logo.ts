/**
 * ALFRED TUI ASCII Logo
 *
 * Beautiful ASCII art logo with animation support.
 */

import { colors } from "../theme";
import { bold, center, fg } from "../typography";

// ─── Logo Variants ───────────────────────────────────────────────────────────

export const LOGO_FULL = `
    ╔═══════════════════════════════════════╗
    ║             A L F R E D               ║
    ║       Cognitive Assistant v1.0        ║
    ╚═══════════════════════════════════════╝
`.trim();

export const LOGO_COMPACT = `
╔═══════════════════════════════════════╗
║             A L F R E D               ║
╚═══════════════════════════════════════╝
`.trim();

export const LOGO_MINIMAL = `
┌─ A L F R E D ─┐
`.trim();

export const LOGO_STYLIZED = `
    ╭───────────────────────────────────────╮
    │   ▄▀█ █   █▀▀ █▀█ █▀▀ █▀▄            │
    │   █▀█ █▄▄ █▀  █▀▄ ██▄ █▄▀            │
    │       Cognitive Assistant v1.0        │
    ╰───────────────────────────────────────╯
`.trim();

// ─── Logo with Color ─────────────────────────────────────────────────────────

export function coloredLogo(
  variant: "full" | "compact" | "minimal" | "stylized" = "full"
): string[] {
  const primary = fg(colors.primary);
  const muted = fg(colors.muted);
  const text = fg(colors.text);

  switch (variant) {
    case "full":
      return [
        muted("    ╔═══════════════════════════════════════╗"),
        muted("    ║") +
          "             " +
          bold(primary("A L F R E D")) +
          "               " +
          muted("║"),
        muted("    ║") +
          "       " +
          text("Cognitive Assistant v1.0") +
          "        " +
          muted("║"),
        muted("    ╚═══════════════════════════════════════╝"),
      ];

    case "compact":
      return [
        muted("╔═══════════════════════════════════════╗"),
        muted("║") +
          "             " +
          bold(primary("A L F R E D")) +
          "               " +
          muted("║"),
        muted("╚═══════════════════════════════════════╝"),
      ];

    case "minimal":
      return [muted("┌─ ") + bold(primary("A L F R E D")) + muted(" ─┐")];

    case "stylized":
      return [
        muted("    ╭───────────────────────────────────────╮"),
        muted("    │   ") +
          primary("▄▀█ █   █▀▀ █▀█ █▀▀ █▀▄") +
          muted("            │"),
        muted("    │   ") +
          primary("█▀█ █▄▄ █▀  █▀▄ ██▄ █▄▀") +
          muted("            │"),
        muted("    │       ") +
          text("Cognitive Assistant v1.0") +
          muted("        │"),
        muted("    ╰───────────────────────────────────────╯"),
      ];
  }
}

// ─── Logo Animation Frames ───────────────────────────────────────────────────

export function logoAnimationFrames(): string[][] {
  const primary = fg(colors.primary);
  const muted = fg(colors.muted);
  const dim = fg(colors.dim);
  const text = fg(colors.text);

  // Frame 0: Empty box
  const frame0 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║                                       ║"),
    muted("    ║                                       ║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  // Frame 1: A appears
  const frame1 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║") +
      "             " +
      dim("A") +
      "                         " +
      muted("║"),
    muted("    ║                                       ║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  // Frame 2: AL appears
  const frame2 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║") +
      "             " +
      dim("A L") +
      "                       " +
      muted("║"),
    muted("    ║                                       ║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  // Frame 3: ALF appears
  const frame3 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║") +
      "             " +
      dim("A L F") +
      "                     " +
      muted("║"),
    muted("    ║                                       ║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  // Frame 4: ALFR appears
  const frame4 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║") +
      "             " +
      dim("A L F R") +
      "                   " +
      muted("║"),
    muted("    ║                                       ║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  // Frame 5: ALFRE appears
  const frame5 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║") +
      "             " +
      dim("A L F R E") +
      "                 " +
      muted("║"),
    muted("    ║                                       ║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  // Frame 6: ALFRED full (dim)
  const frame6 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║") +
      "             " +
      dim("A L F R E D") +
      "               " +
      muted("║"),
    muted("    ║                                       ║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  // Frame 7: ALFRED bright + subtitle fading in
  const frame7 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║") +
      "             " +
      primary("A L F R E D") +
      "               " +
      muted("║"),
    muted("    ║") +
      "       " +
      dim("Cognitive Assistant v1.0") +
      "        " +
      muted("║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  // Frame 8: Full logo bright
  const frame8 = [
    muted("    ╔═══════════════════════════════════════╗"),
    muted("    ║") +
      "             " +
      bold(primary("A L F R E D")) +
      "               " +
      muted("║"),
    muted("    ║") +
      "       " +
      text("Cognitive Assistant v1.0") +
      "        " +
      muted("║"),
    muted("    ╚═══════════════════════════════════════╝"),
  ];

  return [
    frame0,
    frame1,
    frame2,
    frame3,
    frame4,
    frame5,
    frame6,
    frame7,
    frame8,
  ];
}

// ─── Centered Logo ───────────────────────────────────────────────────────────

export function centeredLogo(
  width: number,
  variant: "full" | "compact" | "minimal" | "stylized" = "full"
): string[] {
  const lines = coloredLogo(variant);
  return lines.map((line) => center(line, width));
}

// ─── Logo Dimensions ─────────────────────────────────────────────────────────

export function getLogoDimensions(
  variant: "full" | "compact" | "minimal" | "stylized" = "full"
): {
  width: number;
  height: number;
} {
  const lines = coloredLogo(variant);
  return {
    width: 47, // Max line width without ANSI codes
    height: lines.length,
  };
}
