import { mock, vi } from "bun:test";

export const nodePtySpawnMock = vi.fn(
  (_file: string, _args: string[], _options: unknown) => {
    const dataListeners: ((data: string) => void)[] = [];
    const exitListeners: (() => void)[] = [];
    return {
      onData: (fn: (data: string) => void) => {
        dataListeners.push(fn);
        return {
          dispose: () => {
            const idx = dataListeners.indexOf(fn);
            if (idx !== -1) {
              dataListeners.splice(idx, 1);
            }
          },
        };
      },
      onExit: (fn: () => void) => {
        exitListeners.push(fn);
        return {
          dispose: () => {
            const idx = exitListeners.indexOf(fn);
            if (idx !== -1) {
              exitListeners.splice(idx, 1);
            }
          },
        };
      },
      write: (_data: string) => {},
      resize: (_cols: number, _rows: number) => {},
      kill: () => {
        for (const fn of exitListeners) {
          fn();
        }
      },
    };
  }
);

mock.module("node-pty", () => ({
  default: {
    spawn: nodePtySpawnMock,
  },
}));
