import type { WindowInstance } from "@/store/desktop.types";

export type WindowComponentProps = {
  window: WindowInstance;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onRestore: () => void;
  onFocus: () => void;
};
