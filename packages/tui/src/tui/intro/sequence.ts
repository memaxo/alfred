/**
 * ALFRED TUI Intro Sequence
 *
 * Orchestrates the full intro animation with logo, system checks, and greeting.
 */

import type { TerminalSize } from "../renderer";
import {
  clearScreen,
  getCurrentSize,
  hideCursor,
  showCursor,
  writeAt,
} from "../renderer";
import { colors } from "../theme";
import { dim, fg } from "../typography";
import type { CheckDefinition, SystemCheck } from "./checks";
import {
  createDefaultChecks,
  renderChecks,
  renderChecksSummary,
  resetSpinner,
  runChecks,
} from "./checks";
import { getStatusGreeting, greetingAnimationFrames } from "./greeting";
import { coloredLogo, logoAnimationFrames } from "./logo";

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntroOptions = {
  skipAnimation?: boolean;
  skipChecks?: boolean;
  customChecks?: CheckDefinition[];
  onComplete?: () => void;
  onSkip?: () => void;
};

export type IntroState = {
  phase: "logo" | "checks" | "greeting" | "complete";
  logoFrame: number;
  checks: SystemCheck[];
  greetingFrame: number;
  skipped: boolean;
};

// ─── Animation Timing ────────────────────────────────────────────────────────

const TIMING = {
  logoFrameDelay: 50, // ms between logo frames
  checkSpinnerDelay: 80, // ms between spinner frames
  greetingCharDelay: 30, // ms between characters
  postGreetingDelay: 500, // ms after greeting before complete
  skipFadeDelay: 200, // ms for skip fade
} as const;

// ─── Helper Functions ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Intro Sequence Runner ───────────────────────────────────────────────────

export async function runIntroSequence(
  options: IntroOptions = {}
): Promise<void> {
  const {
    skipAnimation = false,
    skipChecks = false,
    customChecks,
    onComplete,
    onSkip,
  } = options;

  const size = getCurrentSize();
  let skipped = false;

  // Setup skip detection
  const skipHandler = (_data: Buffer) => {
    skipped = true;
  };

  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.once("data", skipHandler);

  try {
    hideCursor();
    clearScreen();

    if (skipAnimation) {
      // Show static logo immediately
      await renderStaticIntro(size, skipChecks ? [] : customChecks);
      onComplete?.();
      return;
    }

    // Phase 1: Logo animation
    await runLogoAnimation(size, () => skipped);
    if (skipped) {
      onSkip?.();
      return;
    }

    // Phase 2: System checks
    let checks: SystemCheck[] = [];
    if (!skipChecks) {
      const checkDefs = customChecks ?? createDefaultChecks();
      checks = await runSystemChecks(size, checkDefs, () => skipped);
      if (skipped) {
        onSkip?.();
        return;
      }
    }

    // Phase 3: Greeting
    const hasWarnings = checks.some((c) => c.status === "warning");
    const hasErrors = checks.some((c) => c.status === "error");
    await runGreetingAnimation(size, hasWarnings, hasErrors, () => skipped);

    await sleep(TIMING.postGreetingDelay);
    onComplete?.();
  } finally {
    process.stdin.off("data", skipHandler);
    process.stdin.setRawMode?.(false);
    showCursor();
  }
}

// ─── Logo Animation ──────────────────────────────────────────────────────────

async function runLogoAnimation(
  size: TerminalSize,
  isSkipped: () => boolean
): Promise<void> {
  const frames = logoAnimationFrames();
  const startY = Math.floor((size.height - 10) / 2);
  const startX = Math.floor((size.width - 47) / 2);

  for (const frame of frames) {
    if (isSkipped()) {
      break;
    }

    clearScreen();
    for (let i = 0; i < frame.length; i++) {
      const line = frame[i];
      if (line) {
        writeAt(startX, startY + i, line);
      }
    }
    await sleep(TIMING.logoFrameDelay);
  }
}

// ─── System Checks ───────────────────────────────────────────────────────────

async function runSystemChecks(
  size: TerminalSize,
  checkDefs: CheckDefinition[],
  isSkipped: () => boolean
): Promise<SystemCheck[]> {
  const logoLines = coloredLogo("full");
  const startY = Math.floor((size.height - 15) / 2);
  const startX = Math.floor((size.width - 47) / 2);

  resetSpinner();

  let finalChecks: SystemCheck[] = [];

  const renderState = (checks: SystemCheck[]) => {
    if (isSkipped()) {
      return;
    }

    clearScreen();

    // Draw logo
    for (let i = 0; i < logoLines.length; i++) {
      const line = logoLines[i];
      if (line) {
        writeAt(startX, startY + i, line);
      }
    }

    // Draw checks below logo
    const checkY = startY + logoLines.length + 2;
    const checkLines = renderChecks(checks);
    for (let i = 0; i < checkLines.length; i++) {
      const line = checkLines[i];
      if (line) {
        writeAt(startX, checkY + i, line);
      }
    }

    // Draw summary if all complete
    const allComplete = checks.every(
      (c) =>
        c.status === "success" || c.status === "warning" || c.status === "error"
    );
    if (allComplete) {
      const summaryLine = renderChecksSummary(checks);
      writeAt(startX, checkY + checks.length + 1, summaryLine);
    }
  };

  // Run checks with spinner animation
  const spinnerInterval = setInterval(() => {
    if (!isSkipped() && finalChecks.length > 0) {
      renderState(finalChecks);
    }
  }, TIMING.checkSpinnerDelay);

  try {
    finalChecks = await runChecks(checkDefs, (checks) => {
      finalChecks = checks;
      renderState(checks);
    });
  } finally {
    clearInterval(spinnerInterval);
  }

  // Final render
  renderState(finalChecks);
  await sleep(300);

  return finalChecks;
}

// ─── Greeting Animation ──────────────────────────────────────────────────────

async function runGreetingAnimation(
  size: TerminalSize,
  hasWarnings: boolean,
  hasErrors: boolean,
  isSkipped: () => boolean
): Promise<void> {
  const greeting = getStatusGreeting(hasWarnings, hasErrors);
  const frames = greetingAnimationFrames(greeting);

  const logoLines = coloredLogo("full");
  const startY = Math.floor((size.height - 15) / 2);
  const startX = Math.floor((size.width - 47) / 2);
  const greetingY = startY + logoLines.length + 8;

  for (const frame of frames) {
    if (isSkipped()) {
      break;
    }
    writeAt(startX, greetingY, frame);
    await sleep(TIMING.greetingCharDelay);
  }
}

// ─── Static Intro (Skip Animation) ───────────────────────────────────────────

async function renderStaticIntro(
  size: TerminalSize,
  customChecks?: CheckDefinition[]
): Promise<void> {
  const logoLines = coloredLogo("full");
  const startY = Math.floor((size.height - 15) / 2);
  const startX = Math.floor((size.width - 47) / 2);

  clearScreen();

  // Draw logo
  for (let i = 0; i < logoLines.length; i++) {
    const line = logoLines[i];
    if (line) {
      writeAt(startX, startY + i, line);
    }
  }

  // If checks provided, run them quickly
  if (customChecks && customChecks.length > 0) {
    const checks = await runChecks(customChecks, () => {});
    const checkY = startY + logoLines.length + 2;
    const checkLines = renderChecks(checks);
    for (let i = 0; i < checkLines.length; i++) {
      const line = checkLines[i];
      if (line) {
        writeAt(startX, checkY + i, line);
      }
    }

    const summaryLine = renderChecksSummary(checks);
    writeAt(startX, checkY + checks.length + 1, summaryLine);

    const hasWarnings = checks.some((c) => c.status === "warning");
    const hasErrors = checks.some((c) => c.status === "error");
    const greeting = getStatusGreeting(hasWarnings, hasErrors);
    const greetingY = checkY + checks.length + 3;
    writeAt(
      startX,
      greetingY,
      `  ${fg(colors.primary)("»")} ${fg(colors.textMuted)(greeting)}`
    );
  }

  await sleep(TIMING.skipFadeDelay);
}

// ─── Quick Intro (Minimal) ───────────────────────────────────────────────────

export async function runQuickIntro(): Promise<void> {
  const size = getCurrentSize();
  const primary = fg(colors.primary);
  const muted = fg(colors.textMuted);

  clearScreen();
  hideCursor();

  const message = `${primary("ALFRED")} ${dim("v1.0")} ${muted("• Initializing...")}`;
  const x = Math.floor((size.width - 30) / 2);
  const y = Math.floor(size.height / 2);

  writeAt(x, y, message);
  await sleep(300);

  const readyMessage = `${primary("ALFRED")} ${dim("v1.0")} ${muted("• Ready")}`;
  writeAt(x, y, readyMessage);
  await sleep(200);

  showCursor();
}

// ─── Export Types ────────────────────────────────────────────────────────────

export type { SystemCheck, CheckDefinition };
