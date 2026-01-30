import { useEffect } from "react";

import type { WindowType } from "@/store/desktop/types.new";

import { useDesktopStore } from "@/store/desktop";

import type { AppMenus } from "../menubar/types";

/**
 * Hook for apps to register their custom menus
 */
export function useAppMenus(type: WindowType, menus: AppMenus) {
  const registerMenus = useDesktopStore((s) => s.registerMenus);
  const unregisterMenus = useDesktopStore((s) => s.unregisterMenus);

  useEffect(() => {
    registerMenus(type, menus);
    return () => unregisterMenus(type);
  }, [type, menus, registerMenus, unregisterMenus]);
}
