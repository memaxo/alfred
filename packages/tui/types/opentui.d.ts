declare module "@opentui/react" {
  import type React from "react";
  import type { CliRenderer, KeyEvent } from "@opentui/core";

  export type Root = {
    render: (node: React.ReactNode) => void;
    unmount: () => void;
  };

  export function createRoot(renderer: CliRenderer): Root;

  export function useKeyboard(
    handler: (event: KeyEvent) => void,
    options?: { release?: boolean }
  ): void;

  export function useTerminalDimensions(): { width: number; height: number };
  export function useOnResize(
    callback: (size: { width: number; height: number }) => void
  ): void;
  export function useRenderer(): CliRenderer;
}
