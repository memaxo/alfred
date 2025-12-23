import type { StateCreator } from "zustand";
import type {
  DesktopState,
  DockSlice,
  WindowInstance,
  WindowType,
} from "./types";

const DEFAULT_DOCK_PINS: WindowType[] = [
  "chat",
  "terminal",
  "note",
  "workflow",
  "droid",
];

export const createDockSlice: StateCreator<DesktopState, [], [], DockSlice> = (
  set,
  get
) => ({
  dockPins: DEFAULT_DOCK_PINS,

  pinType: (type) => {
    set((state) => {
      if (state.dockPins.includes(type)) {
        return state;
      }
      return { dockPins: [...state.dockPins, type] };
    });
  },

  unpinType: (type) => {
    set((state) => ({
      dockPins: state.dockPins.filter((t) => t !== type),
    }));
  },

  spawnWindow: (type, resourceRef, position) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { viewport, windows } = get();

    const spawnPosition = position ?? {
      x: -viewport.x + 400 + Math.random() * 100,
      y: -viewport.y + 300 + Math.random() * 100,
    };

    const singletonTypes: WindowType[] = [
      "chat",
      "terminal",
      "settings",
      "integrations",
      "workflowlist",
      "todo",
    ];
    if (singletonTypes.includes(type)) {
      const existing = windows.find((w) => w.data.type === type);
      if (existing) {
        get().focusWindow(existing.id);
        return existing.id;
      }
    }

    const window: WindowInstance = {
      id,
      type,
      position: spawnPosition,
      data: {
        type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        resourceRef,
        viewMode: "full",
      },
    };

    get().addWindow(window);
    get().focusWindow(id);
    return id;
  },
});
