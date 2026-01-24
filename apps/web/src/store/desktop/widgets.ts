import { nanoid } from "nanoid";

import type { WidgetSlice } from "./types.new";

type SetState = (
  partial:
    | WidgetSlice
    | Partial<WidgetSlice>
    | ((state: WidgetSlice) => WidgetSlice | Partial<WidgetSlice>),
  replace?: boolean
) => void;

export const createWidgetSlice = (set: SetState): WidgetSlice => ({
  pinnedWidgets: [],

  pinWidget: (widget) => {
    const id = nanoid();
    set((state) => ({
      pinnedWidgets: [...state.pinnedWidgets, { ...widget, id }],
    }));
  },

  unpinWidget: (id) => {
    set((state) => ({
      pinnedWidgets: state.pinnedWidgets.filter((w) => w.id !== id),
    }));
  },

  updateWidgetBounds: (id, bounds) => {
    set((state) => ({
      pinnedWidgets: state.pinnedWidgets.map((w) =>
        w.id === id ? { ...w, bounds } : w
      ),
    }));
  },
});
