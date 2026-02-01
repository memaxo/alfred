/**
 * App Menu Types - Context-sensitive menu bar actions
 *
 * Defines the interface for windows to register their menu actions.
 * The MenuBar renders menus based on the currently focused window.
 */

import type { WindowType } from "@/store/desktop/types.new";

export interface AppMenuAction {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

export type AppMenuCategory = "File" | "Edit" | "View" | "Window" | "Help";

export type AppMenus = Partial<Record<AppMenuCategory, AppMenuAction[]>>;

export type MenuRegistry = Partial<Record<WindowType, AppMenus>>;

export const DEFAULT_MENUS: AppMenus = {
  File: [{ id: "close", label: "Close Window", shortcut: "⌘W" }],
  Edit: [
    { id: "undo", label: "Undo", shortcut: "⌘Z", disabled: true },
    { id: "redo", label: "Redo", shortcut: "⇧⌘Z", disabled: true },
    { id: "sep-1", label: "", separator: true },
    { id: "cut", label: "Cut", shortcut: "⌘X", disabled: true },
    { id: "copy", label: "Copy", shortcut: "⌘C", disabled: true },
    { id: "paste", label: "Paste", shortcut: "⌘V", disabled: true },
  ],
  View: [
    { id: "toggle-mindscape", label: "Toggle Mindscape", shortcut: "⌘M" },
    { id: "sep-1", label: "", separator: true },
    { id: "zoom-in", label: "Zoom In", shortcut: "⌘+" },
    { id: "zoom-out", label: "Zoom Out", shortcut: "⌘-" },
    { id: "zoom-reset", label: "Actual Size", shortcut: "⌘0" },
  ],
  Window: [
    { id: "minimize", label: "Minimize", shortcut: "⌘M" },
    { id: "maximize", label: "Maximize" },
    { id: "sep-1", label: "", separator: true },
    { id: "tile-left", label: "Tile Left", shortcut: "⌘←" },
    { id: "tile-right", label: "Tile Right", shortcut: "⌘→" },
  ],
  Help: [
    { id: "docs", label: "Documentation" },
    { id: "shortcuts", label: "Keyboard Shortcuts", shortcut: "⌘/" },
  ],
};
