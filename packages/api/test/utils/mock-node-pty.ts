import { mock } from "bun:test";

mock.module("node-pty", () => ({
  default: {
    spawn: (_file: string, _args: string[], _options: unknown) => {
      const dataListeners: Array<(data: string) => void> = [];
      const exitListeners: Array<() => void> = [];
      return {
        onData: (fn: (data: string) => void) => {
          dataListeners.push(fn);
          return {
            dispose: () => {
              const idx = dataListeners.indexOf(fn);
              if (idx >= 0) {
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
              if (idx >= 0) {
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
    },
  },
}));
