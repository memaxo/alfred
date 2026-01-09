/**
 * Desktop Icons Slice - Desktop surface shortcuts
 *
 * Manages pinnable desktop shortcuts that appear on the background layer.
 * Icons are persisted to localStorage via the parent store's persist middleware.
 */

import type { WindowType } from "./types.new";

export type DesktopIcon = {
  id: string;
  type: WindowType;
  position: { row: number; col: number };
  customLabel?: string;
};

export type DesktopIconSlice = {
  desktopIcons: DesktopIcon[];

  addDesktopIcon: (
    type: WindowType,
    position?: { row: number; col: number }
  ) => string;
  removeDesktopIcon: (iconId: string) => void;
  moveDesktopIcon: (
    iconId: string,
    position: { row: number; col: number }
  ) => void;
  setDesktopIconLabel: (iconId: string, label: string | undefined) => void;
  resetDesktopIcons: () => void;
};

const DEFAULT_ICONS: DesktopIcon[] = [
  { id: "icon-chat", type: "chat", position: { row: 0, col: 0 } },
  { id: "icon-code", type: "code", position: { row: 1, col: 0 } },
  { id: "icon-terminal", type: "terminal", position: { row: 2, col: 0 } },
  { id: "icon-agents", type: "agents", position: { row: 3, col: 0 } },
  { id: "icon-workflow", type: "workflow", position: { row: 4, col: 0 } },
  { id: "icon-knowledge", type: "knowledge", position: { row: 5, col: 0 } },
];

let iconIdCounter = 100;

type SetState = (
  partial:
    | DesktopIconSlice
    | Partial<DesktopIconSlice>
    | ((
        state: DesktopIconSlice
      ) => DesktopIconSlice | Partial<DesktopIconSlice>),
  replace?: boolean
) => void;

type GetState = () => DesktopIconSlice;

export const createDesktopIconSlice = (
  set: SetState,
  get: GetState
): DesktopIconSlice => ({
  desktopIcons: DEFAULT_ICONS,

  addDesktopIcon: (type, position) => {
    const id = `icon-${type}-${iconIdCounter++}`;
    const icons = get().desktopIcons;

    const finalPosition = position ?? findNextAvailablePosition(icons);

    set({
      desktopIcons: [...icons, { id, type, position: finalPosition }],
    });

    return id;
  },

  removeDesktopIcon: (iconId) => {
    set({
      desktopIcons: get().desktopIcons.filter((icon) => icon.id !== iconId),
    });
  },

  moveDesktopIcon: (iconId, position) => {
    set({
      desktopIcons: get().desktopIcons.map((icon) =>
        icon.id === iconId ? { ...icon, position } : icon
      ),
    });
  },

  setDesktopIconLabel: (iconId, label) => {
    set({
      desktopIcons: get().desktopIcons.map((icon) =>
        icon.id === iconId ? { ...icon, customLabel: label } : icon
      ),
    });
  },

  resetDesktopIcons: () => {
    set({ desktopIcons: DEFAULT_ICONS });
  },
});

function findNextAvailablePosition(icons: DesktopIcon[]): {
  row: number;
  col: number;
} {
  const occupied = new Set(
    icons.map((i) => `${i.position.row},${i.position.col}`)
  );

  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 20; row++) {
      if (!occupied.has(`${row},${col}`)) {
        return { row, col };
      }
    }
  }

  return { row: 0, col: 0 };
}
