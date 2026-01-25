/**
 * Shortcuts Router - Keyboard shortcut customization
 *
 * Provides endpoints for managing keyboard shortcuts.
 */

import { z } from "zod";

import { authedProcedure, router } from "../trpc";

const shortcutInput = z.object({
  action: z.string(),
  shortcut: z.string(),
});

export interface Shortcut {
  action: string;
  shortcut: string;
  description: string;
}

// Default shortcuts
const defaultShortcuts: Shortcut[] = [
  {
    action: "command-palette",
    shortcut: "⌘K",
    description: "Open Command Palette",
  },
  {
    action: "toggle-mindscape",
    shortcut: "⌘M",
    description: "Toggle Mindscape Canvas",
  },
  {
    action: "close-window",
    shortcut: "⌘W",
    description: "Close Focused Window",
  },
  {
    action: "hide-window",
    shortcut: "⌘H",
    description: "Hide (Minimize) Window",
  },
  {
    action: "quit-app",
    shortcut: "⌘Q",
    description: "Quit Focused Application",
  },
  {
    action: "cycle-windows",
    shortcut: "⌘Tab",
    description: "Cycle Through Windows",
  },
  {
    action: "focus-tiled",
    shortcut: "⌃Arrows",
    description: "Focus Tiled Window",
  },
  { action: "tile-window", shortcut: "⌘Arrows", description: "Tile Window" },
];

export const shortcutsRouter = router({
  // List all shortcuts
  list: authedProcedure.query(async () => {
    // TODO: Load custom shortcuts from DB, merge with defaults
    return defaultShortcuts;
  }),

  // Update a shortcut
  update: authedProcedure.input(shortcutInput).mutation(async ({ input }) => {
    // TODO: Save to DB
    return {
      success: true,
      action: input.action,
      shortcut: input.shortcut,
    };
  }),

  // Reset shortcuts to defaults
  reset: authedProcedure.mutation(async () => {
    // TODO: Delete custom shortcuts from DB
    return { success: true, shortcuts: defaultShortcuts };
  }),
});
