// Legacy exports (for backwards compatibility during migration)

export { DesktopCanvas } from "./canvas";
export { DesktopCommandPalette } from "./command-palette";
export { Desktop } from "./desktop";
export { Dock } from "./dock";
export * from "./hooks";
export * from "./layers";
export { MenuBar } from "./menubar";
// Phase 1: New shell architecture
export { AlfredDesktopShell, Z_INDEX } from "./shell";
export { Taskbar } from "./taskbar";
export * from "./tiling";
export * from "./windows";
