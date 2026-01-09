/**
 * Menu Slice - App-specific menu registration
 *
 * Windows register their menu actions when focused.
 * The MenuBar renders menus based on the currently focused window type.
 */

import type {
  AppMenus,
  MenuRegistry,
} from "@/components/desktop/menubar/types";
import type { WindowType } from "./types.new";

export type MenuSlice = {
  menuRegistry: MenuRegistry;

  registerMenus: (type: WindowType, menus: AppMenus) => void;
  unregisterMenus: (type: WindowType) => void;
  getMenusForWindow: (type: WindowType | undefined) => AppMenus | undefined;
};

type SetState = (
  partial:
    | MenuSlice
    | Partial<MenuSlice>
    | ((state: MenuSlice) => MenuSlice | Partial<MenuSlice>),
  replace?: boolean
) => void;

type GetState = () => MenuSlice;

export const createMenuSlice = (set: SetState, get: GetState): MenuSlice => ({
  menuRegistry: {},

  registerMenus: (type, menus) => {
    set({
      menuRegistry: {
        ...get().menuRegistry,
        [type]: menus,
      },
    });
  },

  unregisterMenus: (type) => {
    const registry = { ...get().menuRegistry };
    delete registry[type];
    set({ menuRegistry: registry });
  },

  getMenusForWindow: (type) => {
    if (!type) {
      return;
    }
    return get().menuRegistry[type];
  },
});
