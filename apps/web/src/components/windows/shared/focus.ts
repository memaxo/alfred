import { useShallow } from "zustand/react/shallow";

import { useDesktopStore } from "@/store/desktop";

export function useWindowFocus(windowId: string) {
  return useDesktopStore(
    useShallow((state) => {
      const focusedId = state.focusedWindowId;
      const isFocused = focusedId === windowId;
      const isDimmed = focusedId !== null && !isFocused;
      return { isFocused, isDimmed };
    })
  );
}
